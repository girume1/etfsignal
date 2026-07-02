import type { FlowStats, HistoricalInflow } from '../types';

export function computeFlowStats(data: HistoricalInflow[]): FlowStats {
  if (!data.length) return { totalNetFlow: 0, avgDailyNetFlow: 0, longestPositiveStreak: 0 };

  const totalNetFlow = data.reduce((sum, h) => sum + h.inflow, 0);
  const avgDailyNetFlow = totalNetFlow / data.length;

  let longest = 0, current = 0;
  for (const h of data) {
    current = h.inflow > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  const sma30 = compute30DaySma(data.map(h => h.inflow)) ?? undefined;

  return { totalNetFlow, avgDailyNetFlow, longestPositiveStreak: longest, sma30 };
}

/** Returns null below 30 points; otherwise array of length (n-29), sma[i] = mean(inflows[i..i+29]). */
export function compute30DaySma(inflows: number[]): number[] | null {
  if (inflows.length < 30) return null;
  const out: number[] = [];
  for (let i = 0; i <= inflows.length - 30; i++) {
    let sum = 0;
    for (let j = i; j < i + 30; j++) sum += inflows[j];
    out.push(sum / 30);
  }
  return out;
}
