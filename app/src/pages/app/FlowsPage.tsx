import { useMemo, useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, RefreshCw, Award } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { PriceFlowChart } from '../../components/PriceFlowChart';
import { MarketShareDonut } from '../../components/MarketShareDonut';
import { fetchHistoricalInflows, fetchPriceHistory, getLastSuccessfulFetch, type HistoricalInflow, type PricePoint } from '../../services/sosovalue';
import { computeFlowStats } from '../../services/flowAnalyzer';
import type { FlowWindow } from '../../types';

const WINDOWS: FlowWindow[] = [14, 30, 90];

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
  const FlowIcon = positive ? ArrowUp : ArrowDown;
  const label    = positive ? 'NET INFLOW' : 'NET OUTFLOW';

  return (
    <div
      style={{ background: bg, border: `1px solid ${border}` }}
      className="rounded-xl p-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2.5">
        <span
          style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        >
          <FlowIcon size={16} />
        </span>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{asset} 14-Day</div>
          <div className="text-sm font-bold" style={{ color }}>{label}</div>
        </div>
      </div>
      {streak > 0 && (
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-mono">streak</div>
          <div className="text-sm font-bold text-slate-300 flex items-center gap-1">{streak}d <ArrowUp size={12} className="text-green-400 shrink-0" /></div>
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

  // ── 14D/30D/90D window selection (Requirement 4) ──────────────────────────
  const [selectedWindow, setSelectedWindow] = useState<FlowWindow>(14);
  const [windowData, setWindowData] = useState<{
    btc: HistoricalInflow[]; eth: HistoricalInflow[]; btcPrice: PricePoint[]; ethPrice: PricePoint[];
  } | null>(null);
  const [windowLoading, setWindowLoading] = useState(false);

  useEffect(() => {
    if (selectedWindow === 14) { setWindowData(null); return; }
    setWindowLoading(true);
    Promise.all([
      fetchHistoricalInflows('us-btc-spot', selectedWindow),
      fetchHistoricalInflows('us-eth-spot', selectedWindow),
      fetchPriceHistory('us-btc-spot', selectedWindow),
      fetchPriceHistory('us-eth-spot', selectedWindow),
    ])
      .then(([btc, eth, btcPx, ethPx]) => setWindowData({ btc, eth, btcPrice: btcPx, ethPrice: ethPx }))
      .finally(() => setWindowLoading(false));
  }, [selectedWindow]);

  const activeBtcHist  = selectedWindow === 14 ? btcHist  : (windowData?.btc  ?? btcHist);
  const activeEthHist  = selectedWindow === 14 ? ethHist  : (windowData?.eth  ?? ethHist);
  const activeBtcPrice = selectedWindow === 14 ? btcPrice : (windowData?.btcPrice ?? btcPrice);
  const activeEthPrice = selectedWindow === 14 ? ethPrice : (windowData?.ethPrice ?? ethPrice);

  const btcStats = useMemo(() => flowStats(activeBtcHist), [activeBtcHist]);
  const ethStats = useMemo(() => flowStats(activeEthHist), [activeEthHist]);

  // Requirement 4.4/4.5: total/avg/streak + 30-day SMA, only meaningful for 30D/90D
  const btcFlowAnalysis = useMemo(() => selectedWindow !== 14 ? computeFlowStats(activeBtcHist) : null, [selectedWindow, activeBtcHist]);
  const ethFlowAnalysis = useMemo(() => selectedWindow !== 14 ? computeFlowStats(activeEthHist) : null, [selectedWindow, activeEthHist]);

  // Requirement 4.6: badge when both assets show net positive flow over the 90D window
  const showAccumulationBadge = selectedWindow === 90 && !!btcFlowAnalysis && !!ethFlowAnalysis
    && btcFlowAnalysis.totalNetFlow > 0 && ethFlowAnalysis.totalNetFlow > 0;

  const btcLastUpdated = selectedWindow !== 14 ? getLastSuccessfulFetch('us-btc-spot', selectedWindow) : null;

  const btcAum = btcData?.totalNetAssets.value;
  const ethAum = ethData?.totalNetAssets.value;
  // dailyNetInflow.value is raw dollars (unlike the historical inflow array,
  // which is already in millions) — convert so fmtMil's scale assumption holds.
  const btcTodayRaw = btcData?.dailyNetInflow.value;
  const ethTodayRaw = ethData?.dailyNetInflow.value;
  const btcToday = btcTodayRaw != null ? btcTodayRaw / 1_000_000 : null;
  const ethToday = ethTodayRaw != null ? ethTodayRaw / 1_000_000 : null;

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
          <div className="flex items-center gap-1">
            {WINDOWS.map(w => (
              <button
                key={w}
                onClick={() => setSelectedWindow(w)}
                style={{
                  background: selectedWindow === w ? 'rgba(0,255,167,0.1)' : 'transparent',
                  color:      selectedWindow === w ? '#00FFA7' : '#64748B',
                  border:     `1px solid ${selectedWindow === w ? 'rgba(0,255,167,0.25)' : 'var(--brand-border)'}`,
                }}
                className="text-[10px] px-2 py-0.5 rounded font-mono transition-colors"
              >
                {w}D
              </button>
            ))}
            {windowLoading && (
              <RefreshCw size={10} className="animate-spin text-slate-600 shrink-0" />
            )}
          </div>
          {lastUpdated && selectedWindow === 14 && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {selectedWindow !== 14 && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              {activeBtcHist.length < selectedWindow && `${activeBtcHist.length} days available · `}
              {btcLastUpdated && `Last updated: ${btcLastUpdated.toLocaleString()} UTC`}
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
            <RefreshCw size={10} className={`shrink-0${loading ? ' animate-spin' : ''}`} />
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
          value={btcAum ? `$${(btcAum / 1_000_000_000).toFixed(1)}B` : '—'}
          sub="total net assets"
          accent="#F59E0B"
        />
        <StatCard
          label="ETH ETF AUM"
          value={ethAum ? `$${(ethAum / 1_000_000_000).toFixed(1)}B` : '—'}
          sub="total net assets"
          accent="#818CF8"
        />
      </div>

      {/* ── Extended window analysis (30D/90D) — Requirement 4.4, 4.5, 4.6 ──── */}
      {selectedWindow !== 14 && btcFlowAnalysis && ethFlowAnalysis && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap} max-w-screen-2xl mx-auto w-full pt-0`}>
          {showAccumulationBadge && (
            <div
              style={{ background: 'rgba(0,255,167,0.08)', border: '1px solid rgba(0,255,167,0.3)' }}
              className="rounded-xl p-3 flex items-center gap-2.5 sm:col-span-2"
            >
              <Award size={16} style={{ color: '#00FFA7' }} className="shrink-0" />
              <span className="text-xs font-semibold" style={{ color: '#00FFA7' }}>
                Sustained Institutional Accumulation — both BTC and ETH show net positive flow over {selectedWindow}D
              </span>
            </div>
          )}
          {[{ label: 'BTC', analysis: btcFlowAnalysis }, { label: 'ETH', analysis: ethFlowAnalysis }].map(({ label, analysis }) => (
            <div
              key={label}
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              className="rounded-xl p-3 grid grid-cols-3 gap-2"
            >
              <div className="text-center">
                <div className="text-[9px] text-slate-600 font-mono mb-0.5">{label} {selectedWindow}D TOTAL</div>
                <div className="text-xs font-mono font-semibold" style={{ color: analysis.totalNetFlow >= 0 ? '#34D399' : '#F87171' }}>
                  {fmtMil(analysis.totalNetFlow, '$')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-slate-600 font-mono mb-0.5">DAILY AVG</div>
                <div className="text-xs font-mono font-semibold" style={{ color: analysis.avgDailyNetFlow >= 0 ? '#34D399' : '#F87171' }}>
                  {fmtMil(analysis.avgDailyNetFlow, '$')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-slate-600 font-mono mb-0.5">LONGEST STREAK</div>
                <div className="text-xs font-mono font-semibold text-slate-300">
                  {analysis.longestPositiveStreak}d
                  {analysis.sma30 && <span className="text-slate-600"> · 30D SMA {fmtMil(analysis.sma30[analysis.sma30.length - 1], '$')}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

            <PriceFlowChart inflows={activeBtcHist} prices={activeBtcPrice} asset="BTC" />
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

            <PriceFlowChart inflows={activeEthHist} prices={activeEthPrice} asset="ETH" />
            <MarketShareDonut funds={ethData.list} asset="ETH" />
          </div>
        )}
      </div>
    </div>
  );
}
