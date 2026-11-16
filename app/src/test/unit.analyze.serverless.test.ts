// @vitest-environment node
/**
 * Unit tests for Vercel Node.js serverless function api/analyze.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import analyzeHandler from '../../../api/analyze';

function createMockRes() {
  const res: { statusCode: number; body: any; status: (code: number) => any; json: (payload: any) => any } = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/api/analyze Gemini Interactions API handler (Node runtime)', () => {
  it('uses Interactions API with current active models (gemini-4-hydrogen -> gemini-3.8-flash), valid timeouts, and never fabricates on failure', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const capturedCalls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];

    const captureRequest = async (urlOrReq: string | Request, init?: RequestInit) => {
      const url = typeof urlOrReq === 'string' ? urlOrReq : urlOrReq.url;
      const rawHeaders = typeof urlOrReq === 'string' ? init?.headers : urlOrReq.headers;
      const rawBody = typeof urlOrReq === 'string' ? init?.body : await urlOrReq.clone().text();
      capturedCalls.push({
        url,
        headers: Object.fromEntries(new Headers(rawHeaders).entries()),
        body: rawBody ? JSON.parse(String(rawBody)) : null,
      });
    };

    // 1. Primary (gemini-4-hydrogen) succeeds via /v1/interactions without invalid <10s X-Server-Timeout header
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (urlOrReq: string | Request, init?: RequestInit) => {
      await captureRequest(urlOrReq, init);
      return new Response(
        JSON.stringify({
          id: 'int-btc-1',
          status: 'completed',
          steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"direction":"BULLISH"}' }] }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resOk = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { max_tokens: 1000, messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resOk,
    );
    expect(resOk.body).not.toHaveProperty('error');
    expect(resOk.statusCode).toBe(200);
    expect(resOk.body.content[0].text).toBe('{"direction":"BULLISH"}');
    expect(resOk.body._timing.model).toBe('gemini-4-hydrogen');
    expect(capturedCalls[0].url).toContain('/v1/interactions');
    expect(capturedCalls[0].headers['x-server-timeout']).toBeUndefined();
    expect(capturedCalls[0].body.generation_config?.thinking_level).toBe('low');
    expect(capturedCalls[0].body.store).toBe(false);

    // 2. Falls back cleanly to gemini-3.8-flash on HTTP 429 or retired/unavailable primary error
    capturedCalls.length = 0;
    let attempt = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (urlOrReq: string | Request, init?: RequestInit) => {
      attempt++;
      await captureRequest(urlOrReq, init);
      if (attempt === 1) {
        return new Response(
          JSON.stringify({ error: { code: 429, message: 'Rate limited' } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          id: 'int-eth-2',
          status: 'completed',
          steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"direction":"BEARISH"}' }] }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }));

    const resFallback = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { max_tokens: 1000, messages: [{ role: 'user', content: 'Analyze ETH' }] } },
      resFallback,
    );
    expect(resFallback.statusCode).toBe(200);
    expect(resFallback.body._timing.model).toBe('gemini-3.8-flash');
    expect(capturedCalls).toHaveLength(2);
    expect(capturedCalls[1].body.model).toBe('gemini-3.8-flash');
    expect(capturedCalls[1].body.generation_config?.thinking_level).toBe('low');

    // 3. Returns explicit HTTP 504 on timeout and HTTP 503 on upstream failure — never fabricates a signal
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError')));
    const resTimeout = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { max_tokens: 1000, messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      resTimeout,
    );
    expect(resTimeout.statusCode).toBe(504);
    expect(resTimeout.body.errorType).toBe('gemini_timeout');
    expect(resTimeout.body.content).toBeUndefined();

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ error: { code: 503, message: 'Service temporarily overloaded' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )));
    const res503 = createMockRes();
    await analyzeHandler(
      { method: 'POST', body: { max_tokens: 1000, messages: [{ role: 'user', content: 'Analyze BTC' }] } },
      res503,
    );
    expect(res503.statusCode).toBe(503);
    expect(res503.body.error).toBe('Service temporarily overloaded');
    expect(res503.body.content).toBeUndefined();
  });

  it('supports multi-turn AskAI messages and system_instruction via Interactions steps input', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    let capturedBody: any = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (urlOrReq: string | Request, init?: RequestInit) => {
      const rawBody = typeof urlOrReq === 'string' ? init?.body : await urlOrReq.clone().text();
      capturedBody = rawBody ? JSON.parse(String(rawBody)) : null;
      return new Response(
        JSON.stringify({
          id: 'int-chat-1',
          status: 'completed',
          steps: [{ type: 'model_output', content: [{ type: 'text', text: 'IBIT drove +$312M of net inflow.' }] }],
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
    expect(resChat.body.content[0].text).toBe('IBIT drove +$312M of net inflow.');
    expect(capturedBody.system_instruction).toBe('You are The Agent.');
    expect(capturedBody.input).toEqual([
      { type: 'user_input', content: [{ type: 'text', text: 'Summarize inflows' }] },
      { type: 'model_output', content: [{ type: 'text', text: 'Net inflows were positive.' }] },
      { type: 'user_input', content: [{ type: 'text', text: 'Which fund led?' }] },
    ]);
  });
});
