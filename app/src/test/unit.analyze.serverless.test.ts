// @vitest-environment node
/**
 * Unit tests for Vercel Node.js serverless function api/analyze.ts (Kimi K3.1 Pro via NVIDIA NIM)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import analyzeHandler from '../../../api/analyze';

interface MockAnalyzeResponse {
  statusCode: number;
  body: Record<string, unknown> | null;
  status: (code: number) => MockAnalyzeResponse;
  json: (payload: Record<string, unknown>) => MockAnalyzeResponse;
}

function createMockRes(): MockAnalyzeResponse {
  const res: MockAnalyzeResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_MODEL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/api/analyze Kimi NVIDIA NIM handler (Node runtime)', () => {
  it('calls NVIDIA NIM with moonshotai/kimi-k3.1-pro, stream:false, strips fences, ignores reasoning_content, and leaks no key in response or logs', async () => {
    process.env.NVIDIA_API_KEY = '  "nvapi-test-secret-key"  ';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> | null = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      capturedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-kimi-1',
          choices: [{
            message: {
              role: 'assistant',
              reasoning_content: 'Internal chain of thought should be ignored.',
              content: '```json\n{"direction":"BULLISH"}\n```',
            },
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resOk = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { max_tokens: 1000, messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resOk,
    );

    expect(resOk.statusCode).toBe(200);
    expect(capturedUrl).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(capturedHeaders.authorization).toBe('Bearer nvapi-test-secret-key');
    expect(capturedBody).toMatchObject({
      model: 'moonshotai/kimi-k3.1-pro',
      temperature: 0.2,
      stream: false,
      messages: [{ role: 'user', content: 'Analyze BTC' }],
    });
    const body = resOk.body as {
      content: Array<{ text: string }>;
      _timing: { apiMs: number; totalServerMs: number; model: string; provider: string; attempt: number };
    };
    expect(body.content[0].text).toBe('{"direction":"BULLISH"}');
    expect(body.content[0].text).not.toContain('chain of thought');
    expect(body._timing).toMatchObject({
      model: 'moonshotai/kimi-k3.1-pro',
      provider: 'kimi',
      attempt: 1,
    });
    expect(typeof body._timing.apiMs).toBe('number');
    expect(body._timing.apiMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(body._timing)).toEqual([
      'apiMs',
      'totalServerMs',
      'model',
      'provider',
      'attempt',
    ]);
    expect(JSON.stringify(resOk.body)).not.toContain('nvapi-test-secret-key');

    const allLogs = [
      ...logSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errSpy.mock.calls.flat(),
    ].map(x => String(x)).join(' ');
    expect(allLogs).not.toContain('nvapi-test-secret-key');
  });

  it('maps system instruction and multi-turn conversation history cleanly for AskAI', async () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test-secret-key';
    let capturedBody: { messages?: Array<{ role: string; content: string }> } | null = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body
        ? (JSON.parse(String(init.body)) as { messages?: Array<{ role: string; content: string }> })
        : null;
      return new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'IBIT drove +$312M of net inflow.',
            },
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resChat = createMockRes();
    await analyzeHandler(
      {
        method: 'POST',
        body: {
          system: 'You are The Agent.',
          max_tokens: 400,
          messages: [
            { role: 'user', content: 'Summarize inflows' },
            { role: 'assistant', content: 'Net inflows were positive.' },
            { role: 'user', content: 'Which fund led?' },
          ],
        },
      },
      resChat,
    );

    expect(resChat.statusCode).toBe(200);
    const body = resChat.body as { content: Array<{ text: string }> };
    expect(body.content[0].text).toBe('IBIT drove +$312M of net inflow.');
    expect(capturedBody?.messages).toEqual([
      { role: 'system', content: 'You are The Agent.' },
      { role: 'user', content: 'Summarize inflows' },
      { role: 'assistant', content: 'Net inflows were positive.' },
      { role: 'user', content: 'Which fund led?' },
    ]);
  });

  it('retries up to 2 times on 429/503/timeout with recovery, and returns structured retryable errors with no fabricated content when exhausted', async () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test-secret-key';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 1. Fails with 429 + 503 on attempts 1 & 2, recovers on attempt 3
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), { status: 429 });
      }
      if (attempts === 2) {
        return new Response(JSON.stringify({ detail: 'Model overloaded' }), { status: 503 });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"direction":"BEARISH"}' } }] }),
        { status: 200 },
      );
    }));

    const resRecovered = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze ETH' }] } },
      resRecovered,
    );
    expect(attempts).toBe(3);
    expect(resRecovered.statusCode).toBe(200);
    const recBody = resRecovered.body as { content: Array<{ text: string }>; _timing: { attempt: number } };
    expect(recBody._timing.attempt).toBe(3);
    expect(recBody.content[0].text).toBe('{"direction":"BEARISH"}');

    // 2. Fails with timeout on attempt 1, recovers on attempt 2
    attempts = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new DOMException('The operation was aborted', 'AbortError');
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"direction":"BULLISH"}' } }] }),
        { status: 200 },
      );
    }));

    const resTimeoutRecovered = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resTimeoutRecovered,
    );
    expect(attempts).toBe(2);
    expect(resTimeoutRecovered.statusCode).toBe(200);
    const timeoutRecBody = resTimeoutRecovered.body as { content: Array<{ text: string }>; _timing: { attempt: number } };
    expect(timeoutRecBody._timing.attempt).toBe(2);
    expect(timeoutRecBody.content[0].text).toBe('{"direction":"BULLISH"}');

    // 3. Exhausting retries on timeout returns 504 with retryable & fallbackAvailable, never fabricating content
    attempts = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      attempts++;
      throw new DOMException('The operation was aborted', 'AbortError');
    }));
    const resTimeout = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resTimeout,
    );
    expect(attempts).toBe(3);
    expect(resTimeout.statusCode).toBe(504);
    expect(resTimeout.body).toMatchObject({
      errorType: 'ai_timeout',
      retryable: true,
      fallbackAvailable: true,
    });
    expect(resTimeout.body?.content).toBeUndefined();
    expect(String(resTimeout.body?.error)).toContain('waiting for the AI provider');
    expect(String(resTimeout.body?.error)).toContain('Please retry');

    const errorLogs = [
      ...warnSpy.mock.calls.flat(),
      ...errSpy.mock.calls.flat(),
    ].map(x => String(x)).join(' ');
    expect(errorLogs).not.toContain('nvapi-test-secret-key');
  });

  it('returns 500 config_error when key is missing, 401/403 auth_error without retrying, and boolean-only ?health=1 status', async () => {
    // 1. Missing NVIDIA_API_KEY -> 500 config_error + health check booleans only
    const resHealthUnset = createMockRes();
    await analyzeHandler({ method: 'GET', query: { health: '1' } }, resHealthUnset);
    expect(resHealthUnset.statusCode).toBe(200);
    expect(resHealthUnset.body).toEqual({
      ok: true,
      primaryProvider: 'kimi',
      providers: { kimi: false },
      model: 'moonshotai/kimi-k3.1-pro',
    });
    const unsetProviders = (resHealthUnset.body as { ok: unknown; providers: Record<string, unknown> }).providers;
    expect(typeof resHealthUnset.body?.ok).toBe('boolean');
    expect(Object.keys(unsetProviders)).toEqual(['kimi']);
    expect(typeof unsetProviders.kimi).toBe('boolean');

    const resMissing = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resMissing,
    );
    expect(resMissing.statusCode).toBe(500);
    expect(resMissing.body).toMatchObject({
      error: 'NVIDIA_API_KEY not configured',
      errorType: 'config_error',
      retryable: false,
      fallbackAvailable: true,
    });

    // 2. Bare GET (no ?health=1) -> 405 Method not allowed
    const resGet = createMockRes();
    await analyzeHandler({ method: 'GET' }, resGet);
    expect(resGet.statusCode).toBe(405);

    // 3. Bad key -> HTTP 401 and HTTP 403 both fail cleanly with NO retry + boolean health check
    process.env.NVIDIA_API_KEY = 'nvapi-invalid-key';
    const resHealthSet = createMockRes();
    await analyzeHandler({ method: 'GET', url: '/api/analyze?health=1' }, resHealthSet);
    expect(resHealthSet.statusCode).toBe(200);
    const setProviders = (resHealthSet.body as { providers: Record<string, unknown> }).providers;
    expect(Object.keys(setProviders)).toEqual(['kimi']);
    expect(typeof setProviders.kimi).toBe('boolean');
    expect(setProviders.kimi).toBe(true);
    expect(JSON.stringify(resHealthSet.body)).not.toContain('nvapi-invalid-key');

    let fetchCalls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      fetchCalls++;
      return new Response(
        JSON.stringify({ detail: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resAuth401 = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resAuth401,
    );
    expect(fetchCalls).toBe(1);
    expect(resAuth401.statusCode).toBe(401);
    expect(resAuth401.body).toMatchObject({
      error: 'Authentication failed',
      errorType: 'auth_error',
      retryable: false,
      fallbackAvailable: true,
    });

    fetchCalls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      fetchCalls++;
      return new Response(
        JSON.stringify({ detail: 'Forbidden key scope' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resAuth403 = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resAuth403,
    );
    expect(fetchCalls).toBe(1);
    expect(resAuth403.statusCode).toBe(403);
    expect(resAuth403.body).toMatchObject({
      error: 'Forbidden key scope',
      errorType: 'auth_error',
      retryable: false,
      fallbackAvailable: true,
    });
  });

  it('prevents a third attempt from running past TOTAL_BUDGET_MS and keeps totalServerMs within budget', async () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test-secret-key';

    let fakeNow = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    let fetchCalls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      fetchCalls++;
      if (fetchCalls === 1) {
        // Attempt 1 consumes 12s
        fakeNow += 12_000;
      } else if (fetchCalls === 2) {
        // Attempt 2 consumes another 12.5s -> total ~24.85s (with 350ms backoff),
        // leaving <= 1.15s of the 26s TOTAL_BUDGET_MS (< 700ms backoff + 1500ms min window)
        fakeNow += 12_500;
      } else {
        // Should never reach a 3rd attempt
        fakeNow += 5_000;
      }
      return new Response(
        JSON.stringify({ detail: 'Model overloaded' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resBudget = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resBudget,
    );

    expect(fetchCalls).toBe(2);
    expect(resBudget.statusCode).toBe(503);
    const budgetTiming = (resBudget.body as { _timing: { attempts: number; totalServerMs: number } })._timing;
    expect(budgetTiming.attempts).toBe(2);
    expect(budgetTiming.totalServerMs).toBeLessThanOrEqual(26_000);
    expect(resBudget.body).toMatchObject({
      errorType: 'upstream_error',
      retryable: true,
      fallbackAvailable: true,
    });
  });
});
