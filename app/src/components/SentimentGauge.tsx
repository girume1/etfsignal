import type { SentimentScore } from '../types';

interface SentimentGaugeProps {
  sentiment: SentimentScore;
  asset: 'BTC' | 'ETH';
}

/**
 * Half-circle SVG gauge (0 → 100) with color zones:
 *   0–30  red   (bearish)
 *   30–70 amber (mixed)
 *   70+   green (bullish)
 * The needle animates smoothly when `score` changes.
 */
export function SentimentGauge({ sentiment, asset }: SentimentGaugeProps) {
  const { score, label } = sentiment;
  const color =
    score >= 70 ? '#34D399' :
    score >= 45 ? '#FCD34D' :
    score >= 30 ? '#FB923C' : '#F87171';

  // Gauge geometry
  const w = 220, h = 148, cx = w / 2, cy = 108, r = 88;
  const angle = (score / 100) * 180 - 180; // -180 → 0
  const rad = (angle * Math.PI) / 180;
  const needleX = cx + Math.cos(rad) * (r - 8);
  const needleY = cy + Math.sin(rad) * (r - 8);

  // Arc segments
  const arc = (from: number, to: number, col: string) => {
    const f = (from / 100) * 180 - 180;
    const t = (to   / 100) * 180 - 180;
    const fr = (f * Math.PI) / 180;
    const tr = (t * Math.PI) / 180;
    const large = to - from > 50 ? 1 : 0;
    const x1 = cx + Math.cos(fr) * r;
    const y1 = cy + Math.sin(fr) * r;
    const x2 = cx + Math.cos(tr) * r;
    const y2 = cy + Math.sin(tr) * r;
    return <path key={`${from}-${to}`} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
      stroke={col} strokeWidth={10} fill="none" strokeLinecap="round" />;
  };

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4 flex flex-col items-center"
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {asset} Flow Sentiment
        </span>
        <span className="text-[10px] text-slate-600 font-mono tracking-wider">14-day</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="block">
        {/* track */}
        {arc(0, 30, 'rgba(248,113,113,0.25)')}
        {arc(30, 45, 'rgba(251,146,60,0.25)')}
        {arc(45, 70, 'rgba(252,211,77,0.25)')}
        {arc(70, 100, 'rgba(52,211,153,0.25)')}

        {/* active fill */}
        {arc(0, Math.max(0.5, score), color)}

        {/* needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: 'all 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        <circle cx={cx} cy={cy} r="6" fill="#0A0F1E" stroke="#E2E8F0" strokeWidth="2" />

        {/* scale labels */}
        <text x="20"  y={cy + 22} fontSize="10" fill="#64748B" fontFamily="JetBrains Mono">0</text>
        <text x={cx - 6} y="18"   fontSize="10" fill="#64748B" fontFamily="JetBrains Mono">50</text>
        <text x={w - 28} y={cy + 22} fontSize="10" fill="#64748B" fontFamily="JetBrains Mono">100</text>
      </svg>

      <div className="text-center mt-1">
        <div className="font-display text-3xl" style={{ color }}>{score}</div>
        <div className="text-xs font-medium" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}
