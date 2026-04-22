import type { HistoricalInflow, PricePoint } from '../services/sosovalue';

interface PriceFlowChartProps {
  inflows: HistoricalInflow[];
  prices: PricePoint[];
  asset: 'BTC' | 'ETH';
}

/**
 * Combined price line + net inflow bars on a shared x-axis. The overlay tells
 * the institutional-flow / price-action story at a glance:
 *   - Are rising prices confirmed by rising inflows?
 *   - Or is price running ahead of the flow?
 *
 * Self-contained SVG, no chart library. Handles empty-data gracefully.
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

  const W = 320, H = 160;
  const pad = { top: 18, right: 44, bottom: 20, left: 8 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top  - pad.bottom;

  const n = Math.min(inflows.length, prices.length);
  const step = plotW / (n - 1 || 1);

  // Price scale
  const pMin = Math.min(...prices.map(p => p.price));
  const pMax = Math.max(...prices.map(p => p.price));
  const pRange = Math.max(pMax - pMin, 1);
  const priceY = (v: number) => pad.top + plotH - ((v - pMin) / pRange) * plotH;

  // Inflow scale (symmetric around zero for nice bars)
  const fMax = Math.max(1, ...inflows.map(i => Math.abs(i.inflow)));
  const barH = plotH / 2;
  const zeroY = pad.top + plotH / 2;
  const flowY = (v: number) => zeroY - (v / fMax) * barH;

  const linePath = prices.slice(0, n).map((p, i) => {
    const x = pad.left + i * step;
    const y = priceY(p.price);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const latestPrice = prices[n - 1].price;
  const latestInflow = inflows[n - 1].inflow;
  const priceChange = latestPrice - prices[0].price;
  const priceChangePct = (priceChange / prices[0].price) * 100;

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {asset} Price × ETF Flow · 14d
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono font-semibold text-white text-base">
              ${latestPrice.toLocaleString()}
            </span>
            <span
              className="text-xs font-mono"
              style={{ color: priceChange >= 0 ? '#34D399' : '#F87171' }}
            >
              {priceChange >= 0 ? '▲' : '▼'} {priceChangePct.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-[2px]" style={{ background: '#00C2FF' }} /> Price</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: '#34D399' }} /> Inflow</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: '#F87171' }} /> Outflow</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
        {/* zero baseline */}
        <line x1={pad.left} x2={W - pad.right} y1={zeroY} y2={zeroY}
          stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />

        {/* inflow bars */}
        {inflows.slice(0, n).map((f, i) => {
          const x = pad.left + i * step;
          const y = f.inflow >= 0 ? flowY(f.inflow) : zeroY;
          const h = Math.max(1, Math.abs(flowY(f.inflow) - zeroY));
          const bw = Math.max(3, step * 0.55);
          return (
            <rect
              key={f.date}
              x={x - bw / 2} y={y} width={bw} height={h}
              fill={f.inflow >= 0 ? '#34D399' : '#F87171'} fillOpacity="0.7" rx="1"
            >
              <title>{`${f.date}: ${f.inflow >= 0 ? '+' : '-'}$${(Math.abs(f.inflow) / 1e6).toFixed(0)}M`}</title>
            </rect>
          );
        })}

        {/* price line (with subtle area) */}
        <path d={`${linePath} L ${pad.left + (n - 1) * step} ${pad.top + plotH} L ${pad.left} ${pad.top + plotH} Z`}
          fill="url(#priceArea)" opacity="0.4" />
        <path d={linePath} stroke="#00C2FF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* latest price dot */}
        <circle cx={pad.left + (n - 1) * step} cy={priceY(latestPrice)} r="3.5" fill="#00C2FF" />
        <circle cx={pad.left + (n - 1) * step} cy={priceY(latestPrice)} r="7" fill="#00C2FF" opacity="0.25" />

        {/* right-axis price label */}
        <text x={W - pad.right + 4} y={priceY(latestPrice) + 3}
          fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono">
          {`$${(latestPrice / 1000).toFixed(1)}k`}
        </text>

        <defs>
          <linearGradient id="priceArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00C2FF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-600 font-mono">
        <span>{inflows[0].date}</span>
        <span style={{ color: latestInflow >= 0 ? '#34D399' : '#F87171' }}>
          {latestInflow >= 0 ? '+' : '-'}${(Math.abs(latestInflow) / 1e6).toFixed(0)}M today
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
