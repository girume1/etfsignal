import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { HistoricalInflow, PricePoint } from '../services/sosovalue';

interface PriceFlowChartProps {
  inflows: HistoricalInflow[];
  prices: PricePoint[];
  asset: 'BTC' | 'ETH';
}

/** Format a short date label like "Apr 8" */
function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format dollar values on the Y axis */
function fmtPrice(v: number) {
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}
function fmtFlow(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${v < 0 ? '-' : '+'}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${v < 0 ? '-' : '+'}$${(abs / 1e6).toFixed(0)}M`;
  return `${v < 0 ? '-' : '+'}$${abs}`;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const price  = payload.find(p => p.dataKey === 'price');
  const inflow = payload.find(p => p.dataKey === 'inflow');
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
      <div style={{ color: '#94A3B8', marginBottom: 6 }}>{label}</div>
      {price && (
        <div style={{ color: '#00C2FF' }}>
          Price: ${price.value.toLocaleString()}
        </div>
      )}
      {inflow && (
        <div style={{ color: inflow.value >= 0 ? '#34D399' : '#F87171' }}>
          Flow: {fmtFlow(inflow.value)}
        </div>
      )}
    </div>
  );
}

/**
 * Combined price line + net inflow bars on a shared x-axis.
 * Powered by Recharts — full tooltips, responsive container, smooth animations.
 */
export function PriceFlowChart({ inflows, prices, asset }: PriceFlowChartProps) {
  if (inflows.length === 0 || prices.length === 0) {
    return (
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-4 flex items-center justify-center h-48"
      >
        <span className="text-xs text-slate-500">No chart data</span>
      </div>
    );
  }

  const n = Math.min(inflows.length, prices.length);
  const data = Array.from({ length: n }, (_, i) => ({
    date:   shortDate(inflows[i].date),
    inflow: inflows[i].inflow,
    price:  prices[i].price,
  }));

  const latestPrice  = prices[n - 1].price;
  const firstPrice   = prices[0].price;
  const priceChange  = latestPrice - firstPrice;
  const priceChangePct = (priceChange / firstPrice) * 100;
  const latestInflow = inflows[n - 1].inflow;

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {asset} Price × ETF Flow · 14d
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono font-semibold text-white text-base">
              ${latestPrice.toLocaleString()}
            </span>
            <span className="text-xs font-mono" style={{ color: priceChange >= 0 ? '#34D399' : '#F87171' }}>
              {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px]" style={{ background: '#00C2FF' }} /> Price
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#34D399' }} /> Inflow
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#F87171' }} /> Outflow
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00C2FF" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00C2FF" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          {/* Left axis — inflows */}
          <YAxis
            yAxisId="flow"
            orientation="left"
            tickFormatter={fmtFlow}
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />

          {/* Right axis — price */}
          <YAxis
            yAxisId="price"
            orientation="right"
            tickFormatter={fmtPrice}
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

          <ReferenceLine yAxisId="flow" y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />

          {/* Inflow bars */}
          <Bar yAxisId="flow" dataKey="inflow" maxBarSize={18} radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.inflow >= 0 ? '#34D399' : '#F87171'} fillOpacity={0.75} />
            ))}
          </Bar>

          {/* Price line */}
          <Line
            yAxisId="price"
            dataKey="price"
            stroke="#00C2FF"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#00C2FF', strokeWidth: 0 }}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-600 font-mono">
        <span>{shortDate(inflows[0].date)}</span>
        <span style={{ color: latestInflow >= 0 ? '#34D399' : '#F87171' }}>
          {fmtFlow(latestInflow)} today
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
