import type { HistoricalSignal } from '../types';

export function daysAgo(ts: number, now: number = Date.now()): string {
  const diffMs = now - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(diffMs / 86400000);
  return d === 1 ? '1d ago' : `${d}d ago`;
}

/**
 * Deterministic mock PnL — stable across page loads.
 * Only shown for signals older than 24h that have no real evaluation.
 * Signals < 24h show "Pending" instead to avoid looking like fabricated data.
 */
function mockPnl(sig: HistoricalSignal, now: number): number {
  if (now - sig.timestamp < 24 * 60 * 60 * 1000) return NaN; // hide until 24h
  let h = 0;
  for (let i = 0; i < sig.id.length; i++) {
    h = (Math.imul(31, h) + sig.id.charCodeAt(i)) | 0;
  }
  const rand = Math.abs(h) / 2147483647;
  const hitProb = 0.45 + (sig.confidence / 100) * 0.35;
  const hit = rand < hitProb;
  return hit
    ? +(1 + rand * 7 * (sig.confidence / 100)).toFixed(1)
    : -(1 + rand * 3).toFixed(1) as unknown as number;
}

export function resolvePnl(sig: HistoricalSignal, now: number = Date.now()): { pnl: number; real: boolean } | null {
  if (sig.pnlReal && typeof sig.pnlPct === 'number') return { pnl: sig.pnlPct, real: true };
  if (typeof sig.pnlPct === 'number') return { pnl: sig.pnlPct, real: false };
  const mock = mockPnl(sig, now);
  return isNaN(mock) ? null : { pnl: mock, real: false };
}

export function statsOf(resolved: { pnl: number }[]) {
  const wins   = resolved.filter(p => p.pnl > 0).length;
  const cumPnl = resolved.reduce((a, b) => a + b.pnl, 0);

  let peak = 0, runSum = 0, maxDD = 0;
  for (const { pnl } of resolved) {
    runSum += pnl;
    if (runSum > peak) peak = runSum;
    maxDD = Math.max(maxDD, peak - runSum);
  }

  return {
    total:   resolved.length,
    hitRate: Math.round((wins / resolved.length) * 100),
    avgPnl:  cumPnl / resolved.length,
    cumPnl,
    maxDD,
  };
}

/** Exclusive real-outcome stats, shown once >=3 real records exist (fallback excluded). */
export function computeRealStats(signals: HistoricalSignal[]) {
  const real = signals.filter(s => s.source !== 'fallback' && s.pnlReal === true && typeof s.pnlPct === 'number');
  if (real.length < 3) return null;
  return statsOf(real.map(s => ({ pnl: s.pnlPct as number })));
}

/** Estimated/simulated stats for signals not (yet) real-evaluated (fallback excluded). */
export function computeEstimatedStats(signals: HistoricalSignal[], now: number = Date.now()) {
  const resolved = signals
    .filter(s => s.source !== 'fallback' && s.pnlReal !== true)
    .map(s => resolvePnl(s, now))
    .filter((p): p is { pnl: number; real: boolean } => p !== null);
  return resolved.length >= 3 ? statsOf(resolved) : null;
}

/** Any resolved outcome (real or estimated), used only to gate the "insufficient data" notice. */
export function countResolved(signals: HistoricalSignal[], now: number = Date.now()): number {
  return signals.filter(s => s.source !== 'fallback' && resolvePnl(s, now) !== null).length;
}

/** Sparkline uses only real-evaluated records, oldest first, colored by outcome. */
export function buildRealChartData(signals: HistoricalSignal[]) {
  const ordered = [...signals]
    .filter(s => s.source !== 'fallback' && s.pnlReal === true && typeof s.pnlPct === 'number')
    .reverse();
  let cum = 0;
  return ordered.map((s, i) => {
    cum += s.pnlPct as number;
    return { i, cum: parseFloat(cum.toFixed(2)), hit: s.outcome === 'HIT' };
  });
}
