// Vercel Node.js Serverless Function — proxies Google Gemini API calls via @google/genai SDK
// so GEMINI_API_KEY never reaches the browser.

import { GoogleGenAI } from '@google/genai';

// Allow up to 30s on Vercel (prevents default 10s Hobby gateway 504 timeout)
export const maxDuration = 30;

const PRIMARY_MODEL  = 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-2.0-flash';
// Google Gemini rejects any X-Server-Timeout deadline < 10s ("Minimum allowed deadline is 10s").
// @google/genai sets X-Server-Timeout = Math.ceil(timeout / 1000), so every attempt must be >= 10_000ms.
const PRIMARY_TIMEOUT_MS  = 12_000; // X-Server-Timeout: 12s
const FALLBACK_TIMEOUT_MS = 11_000; // X-Server-Timeout: 11s
const FALLBACK_BUDGET_MS  = 16_000; // max 12s + 11s = 23s, safely within Vercel maxDuration = 30s

function isTransientError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    err?.name === 'AbortError' ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('deadline exceeded') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('not found') ||
    msg.includes('thinking')
  );
}

function extractReadableErrorMessage(err: any): string {
  const raw = String(err?.message ?? 'Gemini API request failed').trim();
  if (!raw) return 'Gemini API request failed';
  try {
    const parsed = JSON.parse(raw);
    const nestedMsg = parsed?.error?.message;
    if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
      return nestedMsg.trim();
    }
  } catch {
    // plain string message
  }
  return raw;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : '';
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured',
      errorType: 'config_error',
    });
  }

  const tRequestStart = Date.now();

  try {
    const { system, messages, max_tokens } = req.body ?? {};
    const msgList: Array<{ role: string; content: string }> = Array.isArray(messages) ? messages : [];

    const contents = msgList.length === 1
      ? String(msgList[0]?.content ?? '')
      : msgList.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content ?? '') }],
        }));

    const attempts: Array<{ model: string; supportsThinkingBudget: boolean; timeoutMs: number }> = [
      { model: PRIMARY_MODEL,  supportsThinkingBudget: true,  timeoutMs: PRIMARY_TIMEOUT_MS },
      { model: FALLBACK_MODEL, supportsThinkingBudget: false, timeoutMs: FALLBACK_TIMEOUT_MS },
    ];

    let lastErr: any = null;

    for (let i = 0; i < attempts.length; i++) {
      const { model, supportsThinkingBudget, timeoutMs } = attempts[i];
      const tAttemptStart = Date.now();

      // Disable @google/genai's default 5-attempt 60s exponential backoff (which caused Vercel 504s)
      // and enforce a valid per-attempt deadline (>= 10s required by Gemini X-Server-Timeout).
      const ai = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta',
        httpOptions: {
          timeout: timeoutMs,
          retryOptions: {
            attempts: 1,
          },
        },
      });

      const config: Record<string, unknown> = {};
      if (supportsThinkingBudget) {
        // Disable internal chain-of-thought token delay on Gemini Flash for sub-2s latency
        config.thinkingConfig = { thinkingBudget: 0 };
      }
      if (system) {
        config.systemInstruction = String(system);
      } else {
        config.responseMimeType = 'application/json';
      }
      if (max_tokens) {
        config.maxOutputTokens = Math.max(Number(max_tokens) || 1024, 1024);
      }

      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const text: string = response.text ?? '';
        const geminiApiMs = Date.now() - tAttemptStart;
        const totalServerMs = Date.now() - tRequestStart;

        if (text && text.trim()) {
          return res.status(200).json({
            content: [{ text }],
            _timing: { geminiApiMs, totalServerMs, model, attempt: i + 1 },
          });
        }

        lastErr = new Error(`Empty response from ${model}`);
      } catch (err: any) {
        lastErr = err;
        // Only try fallback model on transient/model errors and if time budget remains
        const elapsedMs = Date.now() - tRequestStart;
        if (!isTransientError(err) || elapsedMs > FALLBACK_BUDGET_MS) {
          break;
        }
      }
    }

    const totalServerMs = Date.now() - tRequestStart;
    const status = Number(lastErr?.status ?? lastErr?.statusCode ?? 0);
    const errMsg = extractReadableErrorMessage(lastErr);
    const lowerMsg = errMsg.toLowerCase();
    const isTimeout =
      lastErr?.name === 'AbortError' ||
      lowerMsg.includes('timeout') ||
      lowerMsg.includes('aborted') ||
      lowerMsg.includes('deadline exceeded') ||
      status === 504 ||
      status === 408;
    const isRateLimit = status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('rate');

    const httpStatus = isTimeout ? 504 : isRateLimit ? 429 : (status >= 400 && status < 600 ? status : 502);
    const errorType = isTimeout ? 'gemini_timeout' : isRateLimit ? 'rate_limit' : 'upstream_error';

    return res.status(httpStatus).json({
      error: isTimeout
        ? `The Agent timed out after ${(totalServerMs / 1000).toFixed(1)}s waiting for Gemini. Please retry.`
        : isRateLimit
          ? 'The Agent is temporarily rate-limited by the upstream AI provider. Please retry in a few seconds.'
          : errMsg,
      errorType,
      _timing: { totalServerMs },
    });
  } catch (err: any) {
    const totalServerMs = Date.now() - tRequestStart;
    return res.status(500).json({
      error: err?.message ?? 'Agent API call failed',
      errorType: 'internal_error',
      _timing: { totalServerMs },
    });
  }
}
