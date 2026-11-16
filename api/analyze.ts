// Vercel Node.js Serverless Function — proxies Google Gemini API calls via @google/genai SDK
// so GEMINI_API_KEY never reaches the browser.

import { GoogleGenAI } from '@google/genai';

// Allow up to 30s on Vercel (prevents default 10s Hobby gateway 504 timeout)
export const maxDuration = 30;

const PRIMARY_MODEL  = 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-2.0-flash';
const PER_ATTEMPT_TIMEOUT_MS = 7500;

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
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('not found')
  );
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

    // Disable @google/genai's default 5-attempt 60s exponential backoff (which caused Vercel 504s)
    // and enforce a strict per-attempt timeout.
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        timeout: PER_ATTEMPT_TIMEOUT_MS,
        retryOptions: {
          attempts: 1,
        },
      },
    });

    const attempts: Array<{ model: string; supportsThinkingBudget: boolean }> = [
      { model: PRIMARY_MODEL,  supportsThinkingBudget: true },
      { model: FALLBACK_MODEL, supportsThinkingBudget: false },
    ];

    let lastErr: any = null;

    for (let i = 0; i < attempts.length; i++) {
      const { model, supportsThinkingBudget } = attempts[i];
      const tAttemptStart = Date.now();

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
        if (!isTransientError(err) || elapsedMs > 12_000) {
          break;
        }
      }
    }

    const totalServerMs = Date.now() - tRequestStart;
    const status = Number(lastErr?.status ?? lastErr?.statusCode ?? 0);
    const errMsg = String(lastErr?.message ?? 'Gemini API request failed');
    const isTimeout = errMsg.toLowerCase().includes('timeout') || errMsg.toLowerCase().includes('aborted') || status === 504 || status === 408;
    const isRateLimit = status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate');

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
