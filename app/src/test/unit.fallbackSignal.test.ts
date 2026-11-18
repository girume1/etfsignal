/**
 * Unit tests for deterministic rule-based fallback signals and archive exclusion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFallbackSignal } from '../services/fallbackSignal';
import {
  computeRealStats,
  computeEstimatedStats,
  countResolved,
  buildRealChartData,
} from '../utils/signalStats';
import { saveSignal, evaluatePendingSignals } from '../services/signalArchive';
import type { EtfData, HistoricalSignal } from '../types';

function makeEtfData(dailyInflow: number | null, cumInflow: number | null = 10_000_000_000): EtfData {
  return {
    totalNetAssets: { value: 100_000_000_000, lastUpdateDate: '2026-11-17' },
    totalNetAssetsPercentage: { value: 0.05, lastUpdateDate: '2026-11-17' },
    totalTokenHoldings: { value: 1_000_000, lastUpdateDate: '2026-11-17' },
    dailyNetInflow: { value: dailyInflow, lastUpdateDate: '2026-11-17' },
    cumNetInflow: { value: cumInflow, lastUpdateDate: '2026-11-17' },
    dailyTotalValueTraded: { value: 2_000_000_000, lastUpdateDate: '2026-11-17' },
    list: [
      {
        id: '1',
        ticker: 'IBIT',
        institute: 'BlackRock',
        netAssets: { value: 50_000_000_000, lastUpdateDate: '2026-11-17' },
        netAssetsPercentage: { value: 0.02, lastUpdateDate: '2026-11-17' },
        dailyNetInflow: { value: dailyInflow, lastUpdateDate: '2026-11-17' },
        cumNetInflow: { value: 30_000_000_000, lastUpdateDate: '2026-11-17' },
        dailyValueTraded: { value: 1_000_000_000, lastUpdateDate: '2026-11-17' },
        fee: { value: 0.0025, lastUpdateDate: '2026-11-17' },
        discountPremiumRate: { value: 0.0002, lastUpdateDate: '2026-11-17' },
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('fallbackSignal & stats exclusion', () => {
  it('produces BULLISH / BEARISH / NEUTRAL directions from flow + sentiment thresholds, caps confidence <= 60, and weights sum to 100', () => {
    const bullishInflows = [10e6, 20e6, 30e6, 40e6, 50e6, 80e6, 120e6, 150e6, 210e6, 260e6, 300e6, 350e6, 400e6, 450e6];
    const bullish = buildFallbackSignal({
      asset: 'BTC',
      etfData: makeEtfData(450_000_000),
      inflows: bullishInflows,
      currentPrice: 95_000,
    });
    expect(bullish.source).toBe('fallback');
    expect(bullish.direction).toBe('BULLISH');
    expect(bullish.confidence).toBeLessThanOrEqual(60);
    expect(bullish.weights).toHaveLength(4);
    expect(bullish.weights!.reduce((sum, w) => sum + w.weight, 0)).toBe(100);
    expect(bullish.takeProfit.price).toBeGreaterThan(95_000);
    expect(bullish.stopLoss.price).toBeLessThan(95_000);

    const bearishInflows = [50e6, 10e6, -20e6, -40e6, -60e6, -80e6, -120e6, -150e6, -200e6, -240e6, -280e6, -310e6, -350e6, -400e6];
    const bearish = buildFallbackSignal({
      asset: 'BTC',
      etfData: makeEtfData(-400_000_000),
      inflows: bearishInflows,
      currentPrice: 95_000,
    });
    expect(bearish.source).toBe('fallback');
    expect(bearish.direction).toBe('BEARISH');
    expect(bearish.confidence).toBeLessThanOrEqual(60);
    expect(bearish.weights!.reduce((sum, w) => sum + w.weight, 0)).toBe(100);
    expect(bearish.takeProfit.price).toBeLessThan(95_000);
    expect(bearish.stopLoss.price).toBeGreaterThan(95_000);

    // Balanced 14D series: recent 3d avg === 0, prior 11d avg === 0, 7/14 positive days -> sentiment = 50 (Neutral)
    const neutralInflows = [5e6, -5e6, 5e6, -5e6, 5e6, -5e6, 5e6, -5e6, 1e6, 0, -1e6, 2e6, -4e6, 2e6];
    const neutral = buildFallbackSignal({
      asset: 'ETH',
      etfData: makeEtfData(1_000_000),
      inflows: neutralInflows,
      currentPrice: 3_200,
    });
    expect(neutral.source).toBe('fallback');
    expect(neutral.direction).toBe('NEUTRAL');
    expect(neutral.confidence).toBeLessThanOrEqual(60);
    expect(neutral.weights!.reduce((sum, w) => sum + w.weight, 0)).toBe(100);
  });

  it('uses ATR multiples for TP/SL when atr > 0', () => {
    const sig = buildFallbackSignal({
      asset: 'BTC',
      etfData: makeEtfData(150_000_000),
      inflows: [10e6, 20e6, 50e6, 80e6, 120e6, 150e6],
      currentPrice: 100_000,
      atr: 2_000,
    });
    // 2.2x ATR on $100,000 = +4.4% TP, 1.2x ATR = -2.4% SL
    expect(sig.takeProfit.pct).toBeCloseTo(4.4, 2);
    expect(sig.stopLoss.pct).toBeCloseTo(-2.4, 2);
    expect(sig.takeProfit.price).toBe(104_400);
    expect(sig.stopLoss.price).toBe(97_600);
  });

  it('excludes fallback signals from hit-rate stats, real chart data, and signalArchive persistence', async () => {
    const oldTs = Date.now() - 48 * 3600 * 1000;
    const records: HistoricalSignal[] = [
      { id: 'fb-1', asset: 'BTC', direction: 'BULLISH', confidence: 55, headline: 'fb1', timestamp: oldTs, pnlReal: true, pnlPct: 5, outcome: 'HIT', source: 'fallback' },
      { id: 'fb-2', asset: 'BTC', direction: 'BULLISH', confidence: 55, headline: 'fb2', timestamp: oldTs, pnlReal: true, pnlPct: 4, outcome: 'HIT', source: 'fallback' },
      { id: 'fb-3', asset: 'ETH', direction: 'BULLISH', confidence: 55, headline: 'fb3', timestamp: oldTs, pnlReal: true, pnlPct: 6, outcome: 'HIT', source: 'fallback' },
      { id: 'ai-1', asset: 'BTC', direction: 'BULLISH', confidence: 78, headline: 'ai1', timestamp: oldTs, pnlReal: true, pnlPct: -2, outcome: 'MISS', source: 'ai' },
    ];

    expect(computeRealStats(records)).toBeNull();
    expect(computeEstimatedStats(records)).toBeNull();
    expect(countResolved(records)).toBe(1);
    expect(buildRealChartData(records)).toHaveLength(1);

    // saveSignal drops fallback entries cleanly
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await saveSignal({
      id: 'fb-drop',
      asset: 'BTC',
      direction: 'BULLISH',
      confidence: 55,
      headline: 'Rule fallback',
      timestamp: Date.now(),
      source: 'fallback',
    });
    expect(localStorage.getItem('etfsignal:history')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    // evaluatePendingSignals ignores fallback PENDING entries
    const fetchArchiveSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([
        {
          id: 'fb-pending',
          asset: 'BTC',
          direction: 'BULLISH',
          confidence: 55,
          headline: 'Rule fallback',
          timestamp: oldTs,
          entryPrice: 95_000,
          tpPrice: 99_000,
          slPrice: 92_000,
          outcome: 'PENDING',
          source: 'fallback',
        },
      ]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchArchiveSpy);
    await evaluatePendingSignals();
    // Called once for /api/signal-archive GET only — never calls Binance klines or PATCH for fallback
    expect(fetchArchiveSpy).toHaveBeenCalledTimes(1);
  });
});
