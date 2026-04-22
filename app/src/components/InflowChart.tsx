import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { HistoricalInflow } from '../services/sosovalue';

interface InflowChartProps {
  data: HistoricalInflow[];
  height?: number;
  label?: string;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface TooltipPayload {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
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
      <div style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ color: val >= 0 ? '#34D399' : '#F87171' }}>
        {formatCompact(val)}
      </div>
    </div>
  );
}

/**
 * 14-day net-inflow bar chart. Positive bars are green, negative red.
 * Powered by Recharts — interactive tooltips, responsive container.
 */
export function InflowChart({ data, height = 100, label = 'Daily Net Inflow · 14d' }: InflowChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', height: height + 64 }}
        className="rounded-xl p-4 flex items-center justify-center"
      >
        <span className="text-xs text-slate-500">No historical data</span>
      </div>
    );
  }

  const chartData = data.map(d => ({
    date:   shortDate(d.date),
    inflow: d.inflow,
  }));

  const latest = data[data.length - 1];

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono" style={{ color: latest.inflow >= 0 ? '#34D399' : '#F87171' }}>
          {formatCompact(latest.inflow)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={v => formatCompact(v)}
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
          <Bar dataKey="inflow" maxBarSize={20} radius={[2, 2, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.inflow >= 0 ? '#34D399' : '#F87171'} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600 font-mono">
        <span>{shortDate(data[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
