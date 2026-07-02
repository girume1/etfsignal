import { describe, it, expect } from 'vitest';
import { computeFlowStats, compute30DaySma } from '../services/flowAnalyzer';
import type { HistoricalInflow } from '../types';

function inflow(date: string, v: number): HistoricalInflow {
  return { date, inflow: v };
}

describe('computeFlowStats', () => {
  it('totalNetFlow, avgDailyNetFlow, and longest streak (not just trailing)', () => {
    // streak of 3 in the middle, then a gap, then a trailing streak of 1
    const data = [
      inflow('d1', 10), inflow('d2', 10), inflow('d3', 10),
      inflow('d4', -5),
      inflow('d5', 1),
    ];
    const stats = computeFlowStats(data);
    expect(stats.totalNetFlow).toBe(26);
    expect(stats.avgDailyNetFlow).toBeCloseTo(5.2, 5);
    expect(stats.longestPositiveStreak).toBe(3); // the 3-day run, not the trailing 1
  });

  it('empty input returns zeroed stats, no sma', () => {
    const stats = computeFlowStats([]);
    expect(stats).toEqual({ totalNetFlow: 0, avgDailyNetFlow: 0, longestPositiveStreak: 0 });
  });
});

describe('compute30DaySma', () => {
  it('returns null below 30 points', () => {
    expect(compute30DaySma(Array(29).fill(1))).toBeNull();
  });

  it('returns length (n-29), each the mean of its 30-value window', () => {
    const inflows = Array.from({ length: 31 }, (_, i) => i + 1); // 1..31
    const sma = compute30DaySma(inflows)!;
    expect(sma).toHaveLength(2);
    expect(sma[0]).toBeCloseTo((1 + 30) / 2, 5);  // mean of 1..30
    expect(sma[1]).toBeCloseTo((2 + 31) / 2, 5);  // mean of 2..31
  });
});
