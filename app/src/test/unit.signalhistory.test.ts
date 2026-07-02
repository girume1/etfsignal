import { describe, it, expect } from 'vitest';
import { computeRealStats, computeEstimatedStats, countResolved, buildRealChartData } from '../components/SignalHistory';
import type { HistoricalSignal } from '../types';

function real(id: string, pnlPct: number, outcome: 'HIT' | 'MISS' | 'EXPIRED'): HistoricalSignal {
  return {
    id, asset: 'BTC', direction: 'BULLISH', confidence: 70, headline: 'x',
    timestamp: Date.now(), pnlPct, pnlReal: true, outcome,
  };
}

describe('SignalHistory stats splitting', () => {
  it('computeRealStats is null below 3 real records, populated at 3+', () => {
    const two = [real('a', 5, 'HIT'), real('b', -2, 'MISS')];
    expect(computeRealStats(two)).toBeNull();

    const three = [...two, real('c', 3, 'HIT')];
    const stats = computeRealStats(three)!;
    expect(stats.total).toBe(3);
    expect(stats.hitRate).toBe(67); // 2 of 3 positive
    expect(stats.cumPnl).toBeCloseTo(6, 2);
  });

  it('computeEstimatedStats ignores pnlReal:true records', () => {
    const signals = [real('a', 5, 'HIT'), real('b', -2, 'MISS'), real('c', 3, 'HIT')];
    expect(computeEstimatedStats(signals)).toBeNull(); // all real, nothing left to estimate
  });

  it('countResolved counts real signals regardless of the 3-record gate', () => {
    const two = [real('a', 5, 'HIT'), real('b', -2, 'MISS')];
    expect(countResolved(two)).toBe(2);
  });

  it('buildRealChartData colors points by outcome, not by pnl sign', () => {
    // MISS outcome can still show a point; only outcome === 'HIT' is green
    const signals = [real('a', 5, 'HIT'), real('b', -2, 'MISS')];
    const chart = buildRealChartData(signals);
    // signals array is newest-first; chart reverses to oldest-first
    expect(chart[0].hit).toBe(false); // 'b' (MISS) is oldest after reverse
    expect(chart[1].hit).toBe(true);  // 'a' (HIT)
    expect(chart[1].cum).toBeCloseTo(3, 2); // -2 + 5
  });
});
