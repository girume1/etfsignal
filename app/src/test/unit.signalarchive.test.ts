import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveSignal, evaluatePendingSignals } from '../services/signalArchive';
import type { HistoricalSignal } from '../types';

const now = Date.now();
const MS_24H = 24 * 60 * 60 * 1000;

const pendingEligible: HistoricalSignal = {
  id: 'eligible', asset: 'BTC', direction: 'BULLISH', confidence: 70,
  headline: 'x', timestamp: now - MS_24H - 1000,
  entryPrice: 100, tpPrice: 110, slPrice: 95, outcome: 'PENDING', pnlReal: false,
};

const tooRecent: HistoricalSignal = {
  ...pendingEligible, id: 'too-recent', timestamp: now - 1000,
};

const alreadyEvaluated: HistoricalSignal = {
  ...pendingEligible, id: 'already-done', outcome: 'HIT', pnlReal: true,
};

const legacyNoTpSl: HistoricalSignal = {
  id: 'legacy', asset: 'ETH', direction: 'BEARISH', confidence: 60,
  headline: 'y', timestamp: now - MS_24H - 1000, entryPrice: 2000,
};

function binanceKlineRow(time: number, high: number, low: number, close: number) {
  return [time, '0', String(high), String(low), String(close), '0'];
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('saveSignal', () => {
  beforeEach(() => localStorage.clear());

  it('writes to localStorage even when the POST fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await saveSignal(pendingEligible);
    const stored = JSON.parse(localStorage.getItem('etfsignal:history') ?? '[]');
    expect(stored[0].id).toBe('eligible');
  });
});

describe('evaluatePendingSignals', () => {
  it('only evaluates PENDING signals >=24h old with tp/sl/entry set', async () => {
    const patchCalls: any[] = [];

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/signal-archive' && (!init || !init.method)) {
        return new Response(JSON.stringify([pendingEligible, tooRecent, alreadyEvaluated, legacyNoTpSl]), { status: 200 });
      }
      if (url.startsWith('https://api.binance.com/api/v3/klines')) {
        // BULLISH HIT: high touches tpPrice (110)
        return new Response(JSON.stringify([binanceKlineRow(pendingEligible.timestamp + 3_600_000, 112, 108, 111)]), { status: 200 });
      }
      if (url === '/api/signal-archive' && init?.method === 'PATCH') {
        patchCalls.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }));

    await evaluatePendingSignals();

    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].id).toBe('eligible');
    expect(patchCalls[0].outcome).toBe('HIT');
    expect(patchCalls[0].pnlPct).toBeCloseTo(10, 2);
    expect(patchCalls[0].pnlReal).toBe(true);
  });
});
