import type { EtfFund } from '../types';

interface MarketShareDonutProps {
  funds: EtfFund[];
  asset: 'BTC' | 'ETH';
}

const PALETTE = ['#00C2FF', '#0057FF', '#A78BFA', '#34D399', '#FCD34D', '#FB923C', '#F87171', '#60A5FA', '#C084FC', '#94A3B8'];

/**
 * Donut chart of net-asset market share per fund. Top 6 issuers render as
 * individual arcs; the rest are bucketed into "Other" so the legend stays
 * readable. Pure SVG — no dependency cost.
 */
export function MarketShareDonut({ funds, asset }: MarketShareDonutProps) {
  const sorted = funds
    .filter(f => (f.netAssets.value ?? 0) > 0)
    .sort((a, b) => (b.netAssets.value! - a.netAssets.value!));

  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const restTotal = rest.reduce((s, f) => s + (f.netAssets.value || 0), 0);
  const total = sorted.reduce((s, f) => s + (f.netAssets.value || 0), 0) || 1;

  const slices = [
    ...top.map((f, i) => ({
      label: f.ticker,
      value: f.netAssets.value || 0,
      color: PALETTE[i],
      pct: ((f.netAssets.value || 0) / total) * 100,
    })),
    ...(rest.length > 0 ? [{
      label: `+${rest.length} others`,
      value: restTotal,
      color: PALETTE[6],
      pct: (restTotal / total) * 100,
    }] : []),
  ];

  // SVG donut
  const size = 150, stroke = 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const leader = slices[0];

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {asset} ETF Market Share
        </span>
        <span className="text-[10px] text-slate-600 font-mono">{slices.length} groups</span>
      </div>

      <div className="flex items-center gap-4">
        <svg width={size} height={size} className="shrink-0 -rotate-90">
          {slices.map(s => {
            const dash = (s.pct / 100) * circumference;
            const el = (
              <circle
                key={s.label}
                cx={cx} cy={cy} r={r}
                fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${s.label}: ${s.pct.toFixed(1)}%`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
          {/* center label */}
          <g transform={`rotate(90 ${cx} ${cy})`}>
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="#64748B" fontFamily="JetBrains Mono">
              Leader
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="13" fill="#E2E8F0" fontWeight="600" fontFamily="DM Sans">
              {leader?.label}
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill={leader?.color || '#94A3B8'} fontFamily="JetBrains Mono">
              {leader ? `${leader.pct.toFixed(1)}%` : '—'}
            </text>
          </g>
        </svg>

        <div className="flex-1 min-w-0 space-y-1.5">
          {slices.map(s => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-slate-300 font-medium truncate flex-1">{s.label}</span>
              <span className="text-slate-500 font-mono">{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
