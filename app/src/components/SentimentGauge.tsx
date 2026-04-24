import type { SentimentScore } from '../types';

interface SentimentGaugeProps {
  sentiment: SentimentScore;
  asset: 'BTC' | 'ETH';
}

const ZONES: [number, number, string][] = [
  [0,  30,  '#F87171'],   // red — bearish
  [30, 45,  '#FB923C'],   // orange — weak
  [45, 70,  '#FCD34D'],   // amber — cautious
  [70, 100, '#34D399'],   // green — bullish
];

export function SentimentGauge({ sentiment, asset }: SentimentGaugeProps) {
  const { score, label } = sentiment;

  const scoreColor =
    score >= 70 ? '#34D399' :
    score >= 45 ? '#FCD34D' :
    score >= 30 ? '#FB923C' : '#F87171';

  const w = 220, h = 150, cx = w / 2, cy = 108, r = 86;

  // CSS rotate: -90° = left (score 0), 0° = top (score 50), +90° = right (score 100)
  const needleAngle = (score / 100) * 180 - 90;

  function arc(from: number, to: number, color: string, opacity: number, strokeWidth = 10) {
    const toAngle = (pct: number) => ((pct / 100) * 180 - 180) * (Math.PI / 180);
    const fa = toAngle(from);
    const ta = toAngle(to);
    const large = to - from > 50 ? 1 : 0;
    const x1 = cx + Math.cos(fa) * r;
    const y1 = cy + Math.sin(fa) * r;
    const x2 = cx + Math.cos(ta) * r;
    const y2 = cy + Math.sin(ta) * r;
    return (
      <path
        key={`${from}-${to}-${color}`}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        opacity={opacity}
      />
    );
  }

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4 flex flex-col items-center"
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {asset} Flow Sentiment
        </span>
        <span className="text-[10px] text-slate-600 font-mono tracking-wider">14-day</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="block overflow-visible">
        {/* Track — dim zone backgrounds */}
        {ZONES.map(([from, to, col]) => arc(from, to, col, 0.18))}

        {/* Active fill — zone colors up to current score */}
        {ZONES.map(([from, to, col]) => {
          if (score <= from) return null;
          const end = Math.min(score, to);
          if (end - from < 0.5) return null;
          return arc(from, end, col, 1, 11);
        })}

        {/* Needle — CSS rotate for smooth browser animation */}
        <g
          transform={`rotate(${needleAngle}, ${cx}, ${cy})`}
          style={{ transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <line
            x1={cx} y1={cy - 4}
            x2={cx} y2={cy - (r - 10)}
            stroke="#E2E8F0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Pivot circle */}
        <circle cx={cx} cy={cy} r="7" fill="#0A0F1E" stroke="#E2E8F0" strokeWidth="2.5" />

        {/* Scale labels */}
        <text x="14"     y={cy + 28} fontSize="11" fill="#64748B" fontFamily="monospace">0</text>
        <text x={cx - 9} y="18"      fontSize="11" fill="#64748B" fontFamily="monospace">50</text>
        <text x={w - 38} y={cy + 28} fontSize="11" fill="#64748B" fontFamily="monospace">100</text>
      </svg>

      {/* Score + label */}
      <div className="text-center -mt-2">
        <div className="font-display text-3xl font-bold" style={{ color: scoreColor }}>{score}</div>
        <div className="text-xs font-medium mt-0.5" style={{ color: scoreColor }}>{label}</div>
      </div>
    </div>
  );
}
