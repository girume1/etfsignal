import type { SentimentScore } from '../types';

// ─── Sentiment score from inflow series ───────────────────────────────────
// Simple but defensible: blend short-term momentum (last 3d vs prev 11d)
// with positive-day ratio. Output clamped to 0–100, 50 = neutral.
export function computeSentiment(inflows: number[]): SentimentScore {
  if (inflows.length < 4) {
    return { score: 50, label: 'Insufficient data', momentum: 0, inflowTrend: inflows };
  }
  const recent = inflows.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const prior  = inflows.slice(0, -3).reduce((a, b) => a + b, 0) / (inflows.length - 3);
  const scale  = Math.max(Math.abs(recent), Math.abs(prior), 1);
  const momentum = Math.max(-1, Math.min(1, (recent - prior) / (scale * 2)));
  const posRatio = inflows.filter(v => v > 0).length / inflows.length;

  const score = Math.round(50 + momentum * 30 + (posRatio - 0.5) * 40);
  const clamped = Math.max(0, Math.min(100, score));

  let label: string;
  if (clamped >= 75)      label = 'Strongly bullish';
  else if (clamped >= 60) label = 'Cautiously bullish';
  else if (clamped >= 45) label = 'Neutral';
  else if (clamped >= 30) label = 'Cautiously bearish';
  else                    label = 'Strongly bearish';

  return { score: clamped, label, momentum, inflowTrend: inflows };
}
