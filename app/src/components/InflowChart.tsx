import type { HistoricalInflow } from '../services/sosovalue';

interface InflowChartProps {
  data: HistoricalInflow[];
  height?: number;
  label?: string;
}

/**
 * Compact SVG sparkline for 14-day ETF net inflows.
 *
 * - Positive bars render green, negative bars red — mirrors the fund-row colours
 *   so the visual language stays consistent across the dashboard.
 * - A zero baseline is drawn so direction is unambiguous at a glance.
 * - Fully self-contained: no chart lib dependency, keeps the bundle slim.
 */
export function InflowChart({ data, height = 72, label = 'Daily Net Inflow · 14d' }: InflowChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', height: height + 48 }}
        className="rounded-xl p-4 flex items-center justify-center"
      >
        <span className="text-xs text-slate-500">No historical data</span>
      </div>
    );
  }

  const values = data.map(d => d.inflow);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const absMax = Math.max(Math.abs(max), Math.abs(min)) || 1;

  const barGap = 3;
  const viewWidth = 300;
  const barWidth = Math.max(4, (viewWidth - (data.length + 1) * barGap) / data.length);
  const zero = height / 2;

  const latest = data[data.length - 1];
  const latestPositive = latest.inflow >= 0;

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <span
          className="text-xs font-mono"
          style={{ color: latestPositive ? '#34D399' : '#F87171' }}
        >
          {formatCompact(latest.inflow)}
        </span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${viewWidth} ${height}`}
        preserveAspectRatio="none"
        className="block"
      >
        {/* zero baseline */}
        <line x1="0" x2={viewWidth} y1={zero} y2={zero}
          stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" strokeWidth="1" />

        {data.map((d, i) => {
          const magnitude = (Math.abs(d.inflow) / absMax) * (height / 2 - 4);
          const positive = d.inflow >= 0;
          const x = barGap + i * (barWidth + barGap);
          const y = positive ? zero - magnitude : zero;
          const h = Math.max(magnitude, 1);
          const fill = positive ? '#34D399' : '#F87171';
          return (
            <rect
              key={d.date}
              x={x} y={y} width={barWidth} height={h}
              fill={fill} fillOpacity="0.85" rx="1"
            >
              <title>{`${d.date}: ${formatCompact(d.inflow)}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600 font-mono">
        <span>{data[0].date}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
