// Vercel Node.js Serverless Function — proxies Google Gemini Interactions API calls via @google/genai SDK
// so GEMINI_API_KEY never reaches the browser.

import { GoogleGenAI } from '@google/genai';

// Allow up to 30s on Vercel (prevents default 10s Hobby gateway 504 timeout)
export const maxDuration = 30;

const PRIMARY_MODEL  = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.8-flash';
// Per-attempt timeouts kept >= 10_000ms and bounded so primary + fallback fits inside maxDuration = 30s.
const PRIMARY_TIMEOUT_MS  = 12_000;
const FALLBACK_TIMEOUT_MS = 11_000;
const FALLBACK_BUDGET_MS  = 16_000;

function isTransientError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const name = String(err?.name ?? '').toLowerCase();
  const msg = String(err?.message ?? err?.body ?? '').toLowerCase();
  return (
    status === 404 ||
    status === 408 ||
    status === 410 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    name === 'aborterror' ||
    name === 'apiuseraborterror' ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('deadline exceeded') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('deprecated') ||
    msg.includes('thinking')
  );
}

function extractReadableErrorMessage(err: any): string {
  const candidates = [err?.body, err?.message];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const trimmed = candidate.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const nestedMsg = parsed?.error?.message;
      if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
        return nestedMsg.trim();
      }
    } catch {
      // Fall through to plain message when not JSON
    }
  }
  const fallback = String(err?.message ?? 'Gemini API request failed').trim();
  return fallback || 'Gemini API request failed';
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

    const input = msgList.length === 1
      ? String(msgList[0]?.content ?? '')
      : msgList.map((m) => ({
          type: (m.role === 'assistant' ? 'model_output' : 'user_input') as 'model_output' | 'user_input',
          content: [{ type: 'text' as const, text: String(m.content ?? '') }],
        }));

    // Interactions API is GA on v1 (default in @google/genai >= 3.0.0)
    const ai = new GoogleGenAI({ apiKey });

    const attempts: Array<{ model: string; thinkingLevel: 'low' | 'medium'; timeoutMs: number }> = [
      { model: PRIMARY_MODEL,  thinkingLevel: 'low', timeoutMs: PRIMARY_TIMEOUT_MS },
      { model: FALLBACK_MODEL, thinkingLevel: 'low', timeoutMs: FALLBACK_TIMEOUT_MS },
    ];

    let lastErr: any = null;

    for (let i = 0; i < attempts.length; i++) {
      const { model, thinkingLevel, timeoutMs } = attempts[i];
      const tAttemptStart = Date.now();

      try {
        const interaction = await ai.interactions.create(
          {
            model,
            input,
            ...(system ? { system_instruction: String(system) } : {}),
            generation_config: {
              thinking_level: thinkingLevel,
              max_output_tokens: Math.max(Number(max_tokens) || 4096, 4096),
            },
            store: false,
          },
          {
            timeout_ms: timeoutMs,
            retries: { strategy: 'none' },
          },
        );

        const text: string = interaction.output_text ?? '';
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
        // Only try fallback model on transient/model availability errors and if time budget remains
        const elapsedMs = Date.now() - tRequestStart;
        if (!isTransientError(err) || elapsedMs > FALLBACK_BUDGET_MS) {
          break;
        }
      }
    }

    const totalServerMs = Date.now() - tRequestStart;
    const status = Number(lastErr?.status ?? lastErr?.statusCode ?? 0);
    const errName = String(lastErr?.name ?? '').toLowerCase();
    const errMsg = extractReadableErrorMessage(lastErr);
    const lowerMsg = errMsg.toLowerCase();
    const isTimeout =
      errName === 'aborterror' ||
      errName === 'apiuseraborterror' ||
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
