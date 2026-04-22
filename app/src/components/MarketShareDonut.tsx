import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { EtfFund } from '../types';

interface MarketShareDonutProps {
  funds: EtfFund[];
  asset: 'BTC' | 'ETH';
}

const PALETTE = [
  '#00C2FF', '#0057FF', '#A78BFA', '#34D399',
  '#FCD34D', '#FB923C', '#F87171', '#60A5FA',
];

interface SliceItem {
  label: string;
  value: number;
  color: string;
  pct: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: SliceItem }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div style={{
      background: 'var(--brand-card)',
      border: '1px solid var(--brand-border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: s.color, fontWeight: 600 }}>{s.label}</div>
      <div style={{ color: '#94A3B8', marginTop: 2 }}>{s.pct.toFixed(1)}% market share</div>
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 2 }}>
        ${(s.value / 1e9).toFixed(2)}B AUM
      </div>
    </div>
  );
}

/**
 * Donut chart of net-asset market share per fund.
 * Top 6 issuers render as individual arcs; the rest are bucketed into "Other".
 * Powered by Recharts — interactive tooltips, smooth animations.
 */
export function MarketShareDonut({ funds, asset }: MarketShareDonutProps) {
  const sorted = funds
    .filter(f => (f.netAssets.value ?? 0) > 0)
    .sort((a, b) => (b.netAssets.value! - a.netAssets.value!));

  const top    = sorted.slice(0, 6);
  const rest   = sorted.slice(6);
  const restTotal = rest.reduce((s, f) => s + (f.netAssets.value || 0), 0);
  const total  = sorted.reduce((s, f) => s + (f.netAssets.value || 0), 0) || 1;

  const slices: SliceItem[] = [
    ...top.map((f, i) => ({
      label: f.ticker,
      value: f.netAssets.value || 0,
      color: PALETTE[i],
      pct:   ((f.netAssets.value || 0) / total) * 100,
    })),
    ...(rest.length > 0 ? [{
      label: `+${rest.length} others`,
      value: restTotal,
      color: PALETTE[6],
      pct:   (restTotal / total) * 100,
    }] : []),
  ];

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
        {/* Donut + center label */}
        <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={64}
                dataKey="value"
                strokeWidth={1}
                stroke="var(--brand-card)"
                animationBegin={0}
                animationDuration={600}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono' }}>Leader</span>
            <span style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600 }}>{leader?.label}</span>
            <span style={{ color: leader?.color || '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}>
              {leader ? `${leader.pct.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Legend */}
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
