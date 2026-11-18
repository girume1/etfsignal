// Vercel Node.js Serverless Function — proxies Kimi K3.1 Pro calls via NVIDIA NIM
// so NVIDIA_API_KEY never reaches the browser.

import { AI_TOTAL_BUDGET_MS } from './aiBudget';

// Allow up to 30s on Vercel (prevents default 10s Hobby gateway 504 timeout)
export const maxDuration = 30;

const NVIDIA_API_URL       = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_NVIDIA_MODEL = 'moonshotai/kimi-k3.1-pro';

// Bounded retry budget inside Vercel's 30s maxDuration (attempt 1 + up to 2 retries on transient errors)
const ATTEMPT_TIMEOUTS_MS = [12_000, 8_000, 5_500] as const;
const RETRY_BACKOFFS_MS   = [350, 700] as const;
const TOTAL_BUDGET_MS     = AI_TOTAL_BUDGET_MS;
const MIN_ATTEMPT_MS      = 1_500;

interface ProviderError extends Error {
  status?: number;
  retryable?: boolean;
}

interface ProviderInput {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number;
}

interface ProviderContext {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

function readEnvClean(value: string | undefined): string {
  return value ? value.trim().replace(/^["']|["']$/g, '') : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();
}

function isAuthError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  return status === 401 || status === 403;
}

function isTransientError(err: any): boolean {
  if (isAuthError(err)) return false;
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const name = String(err?.name ?? '').toLowerCase();
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    name === 'aborterror' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

function extractReadableErrorMessage(raw: string, fallbackStatus: number): string {
  const trimmed = raw.trim();
  if (!trimmed) return `AI provider error (HTTP ${fallbackStatus})`;
  try {
    const parsed = JSON.parse(trimmed);
    const msg =
      parsed?.error?.message ??
      parsed?.detail ??
      parsed?.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim();
    }
  } catch {
    // Plain text response body
  }
  return trimmed.slice(0, 300);
}

async function callKimiProvider(input: ProviderInput, ctx: ProviderContext): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);

  try {
    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: ctx.model,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: 0.2,
        stream: false,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      const err: ProviderError = new Error(extractReadableErrorMessage(rawText, response.status));
      err.status = response.status;
      throw err;
    }

    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      const err: ProviderError = new Error('Invalid JSON response from AI provider');
      err.status = 502;
      throw err;
    }

    // Read ONLY choices[0].message.content — ignore reasoning_content if present
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const err: ProviderError = new Error(`Empty response from ${ctx.model}`);
      err.status = 502;
      throw err;
    }

    return stripCodeFences(content);
  } catch (err: any) {
    if (controller.signal.aborted || err?.name === 'AbortError') {
      const timeoutErr: ProviderError = new Error(`Request timed out after ${ctx.timeoutMs}ms`);
      timeoutErr.name = 'AbortError';
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isHealthCheckRequest(req: any): boolean {
  if (req?.query?.health === '1' || req?.query?.health === 'true') return true;
  if (typeof req?.url === 'string') {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const health = parsed.searchParams.get('health');
      return health === '1' || health === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

export default async function handler(req: any, res: any) {
  const apiKey = readEnvClean(process.env.NVIDIA_API_KEY);
  const model = readEnvClean(process.env.NVIDIA_MODEL) || DEFAULT_NVIDIA_MODEL;

  if (req.method === 'GET' && isHealthCheckRequest(req)) {
    return res.status(200).json({
      ok: true,
      primaryProvider: 'kimi',
      providers: {
        kimi: Boolean(apiKey),
      },
      model,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'NVIDIA_API_KEY not configured',
      errorType: 'config_error',
      retryable: false,
      fallbackAvailable: true,
    });
  }

  const tRequestStart = Date.now();

  try {
    const { system, messages, max_tokens } = req.body ?? {};
    const msgList: Array<{ role?: string; content?: string }> = Array.isArray(messages) ? messages : [];

    const kimiMessages: ProviderInput['messages'] = [];
    if (system && String(system).trim()) {
      kimiMessages.push({ role: 'system', content: String(system) });
    }
    for (const m of msgList) {
      kimiMessages.push({
        role: m?.role === 'assistant' ? 'assistant' : 'user',
        content: String(m?.content ?? ''),
      });
    }

    const input: ProviderInput = {
      messages: kimiMessages,
      // Allocate extra output headroom when Kimi produces reasoning_content alongside message.content
      maxTokens: Math.max(Number(max_tokens) || 2048, 2048),
    };

    let lastErr: any = null;
    let attemptsMade = 0;

    for (let i = 0; i < ATTEMPT_TIMEOUTS_MS.length; i++) {
      const elapsedBefore = Date.now() - tRequestStart;
      const remainingMs = TOTAL_BUDGET_MS - elapsedBefore;
      if (i > 0 && remainingMs < MIN_ATTEMPT_MS) {
        break;
      }

      const timeoutMs = Math.min(ATTEMPT_TIMEOUTS_MS[i], Math.max(remainingMs, MIN_ATTEMPT_MS));
      const tAttemptStart = Date.now();
      attemptsMade = i + 1;

      try {
        const text = await callKimiProvider(input, { apiKey, model, timeoutMs });
        const apiMs = Date.now() - tAttemptStart;
        const totalServerMs = Date.now() - tRequestStart;

        return res.status(200).json({
          content: [{ text }],
          _timing: {
            apiMs,
            totalServerMs,
            model,
            provider: 'kimi',
            attempt: i + 1,
          },
        });
      } catch (err: any) {
        lastErr = err;
        if (!isTransientError(err) || i === ATTEMPT_TIMEOUTS_MS.length - 1) {
          break;
        }

        const backoffMs = RETRY_BACKOFFS_MS[i] ?? 500;
        const elapsedAfterErr = Date.now() - tRequestStart;
        if (TOTAL_BUDGET_MS - elapsedAfterErr <= backoffMs + MIN_ATTEMPT_MS) {
          break;
        }
        await sleep(backoffMs);
      }
    }

    const totalServerMs = Date.now() - tRequestStart;
    const status = Number(lastErr?.status ?? lastErr?.statusCode ?? 0);
    const errName = String(lastErr?.name ?? '').toLowerCase();
    const errMsg = String(lastErr?.message ?? 'AI provider request failed');
    const lowerMsg = errMsg.toLowerCase();

    if (isAuthError(lastErr)) {
      return res.status(status === 403 ? 403 : 401).json({
        error: errMsg || 'Unauthorized: check NVIDIA_API_KEY configuration',
        errorType: 'auth_error',
        retryable: false,
        fallbackAvailable: true,
        _timing: { totalServerMs, attempts: attemptsMade },
      });
    }

    const isTimeout =
      errName === 'aborterror' ||
      lowerMsg.includes('timeout') ||
      lowerMsg.includes('timed out') ||
      lowerMsg.includes('aborted') ||
      status === 504 ||
      status === 408;
    const isRateLimit = status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('rate');

    const httpStatus = isTimeout ? 504 : isRateLimit ? 429 : (status >= 400 && status < 600 ? status : 502);
    const errorType = isTimeout ? 'ai_timeout' : isRateLimit ? 'rate_limit' : 'upstream_error';

    return res.status(httpStatus).json({
      error: isTimeout
        ? `The Agent timed out after ${(totalServerMs / 1000).toFixed(1)}s waiting for the AI provider. Please retry.`
        : isRateLimit
          ? 'The Agent is temporarily rate-limited by the upstream AI provider. Please retry in a few seconds.'
          : errMsg,
      errorType,
      retryable: true,
      fallbackAvailable: true,
      _timing: { totalServerMs, attempts: attemptsMade },
    });
  } catch (err: any) {
    const totalServerMs = Date.now() - tRequestStart;
    return res.status(500).json({
      error: err?.message ?? 'Agent API call failed',
      errorType: 'internal_error',
      retryable: true,
      fallbackAvailable: true,
      _timing: { totalServerMs },
    });
  }
}
