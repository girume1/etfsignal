import { useMemo } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { PriceFlowChart } from '../../components/PriceFlowChart';
import { MarketShareDonut } from '../../components/MarketShareDonut';
import type { HistoricalInflow } from '../../services/sosovalue';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMil(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1)}B`;
  return `${sign}${prefix}${abs.toFixed(0)}M`;
}

function flowStats(hist: HistoricalInflow[]) {
  if (!hist.length) return { net: 0, avg: 0, best: 0, worst: 0, streak: 0 };
  const net   = hist.reduce((s, h) => s + h.inflow, 0);
  const avg   = net / hist.length;
  const best  = Math.max(...hist.map(h => h.inflow));
  const worst = Math.min(...hist.map(h => h.inflow));
  // consecutive inflow days from the end
  let streak = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].inflow > 0) streak++;
    else break;
  }
  return { net, avg, best, worst, streak };
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1 px-0.5">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--brand-border)' }} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
  accent?: string;
}
function StatCard({ label, value, sub, positive, accent }: StatCardProps) {
  const color = accent ?? (positive == null ? '#94A3B8' : positive ? '#34D399' : '#F87171');
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4 flex flex-col gap-1"
    >
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-lg font-bold font-mono" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-slate-600 font-mono">{sub}</span>}
    </div>
  );
}

interface FlowDirectionBadgeProps {
  net: number;
  streak: number;
  asset: 'BTC' | 'ETH';
}
function FlowDirectionBadge({ net, streak, asset }: FlowDirectionBadgeProps) {
  const positive = net > 0;
  const color   = positive ? '#34D399' : '#F87171';
  const bg      = positive ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)';
  const border  = positive ? 'rgba(52,211,153,0.3)'  : 'rgba(248,113,113,0.3)';
  const icon    = positive ? '↑' : '↓';
  const label   = positive ? 'NET INFLOW' : 'NET OUTFLOW';

  return (
    <div
      style={{ background: bg, border: `1px solid ${border}` }}
      className="rounded-xl p-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2.5">
        <span
          style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold"
        >
          {icon}
        </span>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{asset} 14-Day</div>
          <div className="text-sm font-bold" style={{ color }}>{label}</div>
        </div>
      </div>
      {streak > 0 && (
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-mono">streak</div>
          <div className="text-sm font-bold text-slate-300">{streak}d <span className="text-green-400">↑</span></div>
        </div>
      )}
    </div>
  );
}

interface FlowMiniStatsProps {
  stats: ReturnType<typeof flowStats>;
}
function FlowMiniStats({ stats }: FlowMiniStatsProps) {
  const items = [
    { label: 'Daily Avg', value: fmtMil(stats.avg, '$'), positive: stats.avg >= 0 },
    { label: 'Best Day',  value: fmtMil(stats.best, '$'), positive: true },
    { label: 'Worst Day', value: fmtMil(stats.worst, '$'), positive: stats.worst >= 0 },
  ];
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl px-4 py-3 grid grid-cols-3 gap-2"
    >
      {items.map(item => (
        <div key={item.label} className="text-center">
          <div className="text-[10px] text-slate-600 font-mono mb-0.5">{item.label}</div>
          <div
            className="text-xs font-mono font-semibold"
            style={{ color: item.positive ? '#34D399' : '#F87171' }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const {
    btcData, ethData,
    btcHist, ethHist,
    btcPrice, ethPrice,
    loading, lastUpdated, refresh,
  } = useDashboard();
  const { density } = useDensity();

  const mobile = density === 'mobile';
  const gap    = density === 'comfortable' ? 'gap-5 p-5' : 'gap-4 p-4';

  const btcStats = useMemo(() => flowStats(btcHist), [btcHist]);
  const ethStats = useMemo(() => flowStats(ethHist), [ethHist]);

  const btcAum = btcData?.totalNetAssets.value;
  const ethAum = ethData?.totalNetAssets.value;
  const btcToday = btcData?.dailyNetInflow.value;
  const ethToday = ethData?.dailyNetInflow.value;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="px-5 py-3 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white uppercase tracking-widest font-mono">
            Flow Analysis
          </span>
          <span
            style={{ background: 'rgba(0,87,255,0.12)', color: '#60A5FA', border: '1px solid rgba(0,87,255,0.25)' }}
            className="text-[10px] px-2 py-0.5 rounded font-mono"
          >
            14-DAY
          </span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
            Institutional flow data by SoSoValue
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            style={{ border: '1px solid var(--brand-border)', color: '#64748B' }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-mono hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <QuickStats />

      {/* ── Summary stat row ────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 ${gap} max-w-screen-2xl mx-auto w-full`}>
        <StatCard
          label="BTC 14D Net Flow"
          value={fmtMil(btcStats.net, '$')}
          sub={`${btcStats.streak}d inflow streak`}
          positive={btcStats.net >= 0}
        />
        <StatCard
          label="ETH 14D Net Flow"
          value={fmtMil(ethStats.net, '$')}
          sub={`${ethStats.streak}d inflow streak`}
          positive={ethStats.net >= 0}
        />
        <StatCard
          label="BTC ETF AUM"
          value={btcAum ? `$${(btcAum / 1_000).toFixed(1)}B` : '—'}
          sub="total net assets"
          accent="#F59E0B"
        />
        <StatCard
          label="ETH ETF AUM"
          value={ethAum ? `$${(ethAum / 1_000).toFixed(1)}B` : '—'}
          sub="total net assets"
          accent="#818CF8"
        />
      </div>

      {/* ── Side-by-side charts ─────────────────────────────────────────── */}
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} ${gap} max-w-screen-2xl mx-auto w-full pt-0`}>

        {/* BTC */}
        {btcData && (
          <div className="flex flex-col gap-3">
            <SectionLabel>BTC ETF Flows</SectionLabel>

            <FlowDirectionBadge net={btcStats.net} streak={btcStats.streak} asset="BTC" />
            <FlowMiniStats stats={btcStats} />

            {/* Today's flow highlight */}
            {btcToday != null && (
              <div
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                className="rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Today&apos;s Flow</span>
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: btcToday >= 0 ? '#34D399' : '#F87171' }}
                >
                  {fmtMil(btcToday, '$')}
                </span>
              </div>
            )}

            <PriceFlowChart inflows={btcHist} prices={btcPrice} asset="BTC" />
            <MarketShareDonut funds={btcData.list} asset="BTC" />
          </div>
        )}

        {/* ETH */}
        {ethData && (
          <div className="flex flex-col gap-3">
            <SectionLabel>ETH ETF Flows</SectionLabel>

            <FlowDirectionBadge net={ethStats.net} streak={ethStats.streak} asset="ETH" />
            <FlowMiniStats stats={ethStats} />

            {/* Today's flow highlight */}
            {ethToday != null && (
              <div
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                className="rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Today&apos;s Flow</span>
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: ethToday >= 0 ? '#34D399' : '#F87171' }}
                >
                  {fmtMil(ethToday, '$')}
                </span>
              </div>
            )}

            <PriceFlowChart inflows={ethHist} prices={ethPrice} asset="ETH" />
            <MarketShareDonut funds={ethData.list} asset="ETH" />
          </div>
        )}
      </div>
    </div>
  );
}
