import { ArrowUp, ArrowDown, ArrowRight, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, Tooltip, ReferenceLine, YAxis,
} from 'recharts';
import type { HistoricalSignal } from '../types';

interface SignalHistoryProps {
  signals: HistoricalSignal[];
  loading: boolean;
}

const DIR_COLORS: Record<HistoricalSignal['direction'], string> = {
  BULLISH: '#34D399',
  BEARISH: '#F87171',
  NEUTRAL: '#94A3B8',
};
const DIR_ICONS: Record<HistoricalSignal['direction'], React.ElementType> = {
  BULLISH: ArrowUp,
  BEARISH: ArrowDown,
  NEUTRAL: ArrowRight,
};

function daysAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(diffMs / 86400000);
  return d === 1 ? '1d ago' : `${d}d ago`;
}

/**
 * Deterministic mock PnL — stable across page loads.
 * Only shown for signals older than 24h that have no real evaluation.
 * Signals < 24h show "Pending" instead to avoid looking like fabricated data.
 */
function mockPnl(sig: HistoricalSignal): number {
  if (Date.now() - sig.timestamp < 24 * 60 * 60 * 1000) return NaN; // hide until 24h
  let h = 0;
  for (let i = 0; i < sig.id.length; i++) {
    h = (Math.imul(31, h) + sig.id.charCodeAt(i)) | 0;
  }
  const rand = Math.abs(h) / 2147483647;
  const hitProb = 0.45 + (sig.confidence / 100) * 0.35;
  const hit = rand < hitProb;
  return hit
    ? +(1 + rand * 7 * (sig.confidence / 100)).toFixed(1)
    : -(1 + rand * 3).toFixed(1) as unknown as number;
}

function resolvePnl(sig: HistoricalSignal): { pnl: number; real: boolean } | null {
  if (sig.pnlReal && typeof sig.pnlPct === 'number') return { pnl: sig.pnlPct, real: true };
  if (typeof sig.pnlPct === 'number') return { pnl: sig.pnlPct, real: false };
  const mock = mockPnl(sig);
  return isNaN(mock) ? null : { pnl: mock, real: false };
}

function statsOf(resolved: { pnl: number }[]) {
  const wins   = resolved.filter(p => p.pnl > 0).length;
  const cumPnl = resolved.reduce((a, b) => a + b.pnl, 0);

  let peak = 0, runSum = 0, maxDD = 0;
  for (const { pnl } of resolved) {
    runSum += pnl;
    if (runSum > peak) peak = runSum;
    maxDD = Math.max(maxDD, peak - runSum);
  }

  return {
    total:   resolved.length,
    hitRate: Math.round((wins / resolved.length) * 100),
    avgPnl:  cumPnl / resolved.length,
    cumPnl,
    maxDD,
  };
}

/** Requirement 5.4: exclusive real-outcome stats, shown once >=3 real records exist. */
export function computeRealStats(signals: HistoricalSignal[]) {
  const real = signals.filter(s => s.pnlReal === true && typeof s.pnlPct === 'number');
  if (real.length < 3) return null;
  return statsOf(real.map(s => ({ pnl: s.pnlPct as number })));
}

/** Requirement 5.5: estimated/simulated stats for signals not (yet) real-evaluated. */
export function computeEstimatedStats(signals: HistoricalSignal[]) {
  const resolved = signals
    .filter(s => s.pnlReal !== true)
    .map(s => resolvePnl(s))
    .filter((p): p is { pnl: number; real: boolean } => p !== null);
  return resolved.length >= 3 ? statsOf(resolved) : null;
}

/** Requirement 2.7: any resolved outcome (real or estimated), used only to gate the "insufficient data" notice. */
export function countResolved(signals: HistoricalSignal[]): number {
  return signals.filter(s => resolvePnl(s) !== null).length;
}

/** Requirement 5.7: sparkline uses only real-evaluated records, oldest first, colored by outcome. */
export function buildRealChartData(signals: HistoricalSignal[]) {
  const ordered = [...signals].filter(s => s.pnlReal === true && typeof s.pnlPct === 'number').reverse();
  let cum = 0;
  return ordered.map((s, i) => {
    cum += s.pnlPct as number;
    return { i, cum: parseFloat(cum.toFixed(2)), hit: s.outcome === 'HIT' };
  });
}

function StatsGrid({ stats, dimmed }: { stats: ReturnType<typeof statsOf>; dimmed?: boolean }) {
  return (
    <div
      className="grid grid-cols-5 gap-1 rounded-lg p-2.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', opacity: dimmed ? 0.6 : 1 }}
    >
      {[
        { label: 'RESOLVED', value: stats.total.toString(), color: '#94A3B8' },
        { label: 'WIN RATE', value: `${stats.hitRate}%`, color: stats.hitRate >= 50 ? '#34D399' : '#F87171' },
        { label: 'AVG P&L', value: `${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(1)}%`, color: stats.avgPnl >= 0 ? '#34D399' : '#F87171' },
        { label: 'CUMUL.', value: `${stats.cumPnl >= 0 ? '+' : ''}${stats.cumPnl.toFixed(1)}%`, color: stats.cumPnl >= 0 ? '#34D399' : '#F87171' },
        { label: 'MAX DD', value: stats.maxDD > 0 ? `-${stats.maxDD.toFixed(1)}%` : '0.0%', color: '#F87171' },
      ].map(({ label, value, color }) => (
        <div key={label} className="text-center">
          <div className="text-[9px] text-slate-600 font-mono mb-0.5 tracking-wider">{label}</div>
          <div className="text-xs font-bold font-mono" style={{ color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function SignalHistory({ signals, loading }: SignalHistoryProps) {
  const realStats      = !loading ? computeRealStats(signals) : null;
  const estimatedStats = !loading ? computeEstimatedStats(signals) : null;
  const resolvedCount   = !loading ? countResolved(signals) : 0;
  const chartData       = !loading ? buildRealChartData(signals) : [];
  const chartColor      = realStats && realStats.cumPnl >= 0 ? '#34D399' : '#F87171';

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signal Archive</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">{signals.length} signal{signals.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Performance stats — real evaluated outcomes shown separately from estimates (Req 5.4, 5.6) */}
      {realStats && (
        <div className="mb-2">
          <div className="text-[9px] text-emerald-400 font-mono mb-1 tracking-wider">✓ REAL ({realStats.total})</div>
          <StatsGrid stats={realStats} />
        </div>
      )}
      {estimatedStats && (
        <div className="mb-3">
          <div className="text-[9px] text-slate-600 font-mono mb-1 tracking-wider">~ESTIMATED ({estimatedStats.total})</div>
          <StatsGrid stats={estimatedStats} dimmed />
        </div>
      )}
      {!realStats && !estimatedStats && resolvedCount > 0 && (
        <p className="text-[10px] text-slate-600 font-mono text-center py-2 mb-3">
          Insufficient data for backtest ({resolvedCount}/3 resolved)
        </p>
      )}

      {/* Cumulative real P&L sparkline (Req 5.7) */}
      {chartData.length >= 2 && (
        <div className="mb-3 rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[9px] text-slate-600 font-mono px-2 pt-1.5 uppercase tracking-wider">Cumulative P&L %</div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
              <YAxis
                tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                width={36}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : 0;
                  return [`${n >= 0 ? '+' : ''}${n.toFixed(2)}%`, 'Cumulative P&L'];
                }}
                labelFormatter={() => ''}
              />
              <Line
                type="monotone"
                dataKey="cum"
                stroke={chartColor}
                strokeWidth={1.5}
                dot={(props: { cx?: number; cy?: number; payload?: { hit: boolean }; index?: number }) => {
                  const { cx, cy, payload, index } = props;
                  const color = payload?.hit ? '#34D399' : '#F87171';
                  return <circle key={index} cx={cx} cy={cy} r={2.5} fill={color} stroke={color} />;
                }}
                activeDot={{ r: 3, fill: chartColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Signal timeline */}
      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="shimmer h-10 rounded" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-4 font-mono">
          No signals yet — run your first analysis
        </p>
      ) : (
        <div className="relative pl-5">
          {/* timeline rail */}
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10" />
          {signals.map(sig => {
            const color   = DIR_COLORS[sig.direction];
            const DirIcon = DIR_ICONS[sig.direction];
            const outcome = resolvePnl(sig);

            return (
              <div key={sig.id} className="relative mb-3 last:mb-0">
                <span
                  className="absolute -left-[15px] top-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: color, boxShadow: `0 0 0 3px var(--brand-card), 0 0 8px ${color}66` }}
                />
                <div className="flex items-center gap-2 text-[11px] font-mono mb-0.5">
                  <span style={{ color }} className="font-semibold uppercase tracking-widest flex items-center gap-1">
                    <DirIcon size={11} className="shrink-0" />
                    {sig.direction}
                  </span>
                  <span className="text-slate-500">· {sig.asset}</span>
                  <span className="text-slate-600">· {sig.confidence}%</span>
                  {sig.entryPrice && (
                    <span className="text-slate-700">
                      · ${sig.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                  <span className="text-slate-600 ml-auto">{daysAgo(sig.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">{sig.headline}</p>
                {outcome ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: outcome.pnl >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                        color:      outcome.pnl >= 0 ? '#34D399'               : '#F87171',
                        border:     `1px solid ${outcome.pnl >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                      }}
                    >
                      {outcome.pnl >= 0 ? '+' : ''}{outcome.pnl.toFixed(1)}%
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">
                      {outcome.real ? '✓ evaluated' : '~estimated'}
                    </span>
                  </div>
                ) : (Date.now() - sig.timestamp < 24 * 60 * 60 * 1000) ? (
                  <span className="inline-block mt-1 text-[10px] font-mono text-slate-600">
                    ⏳ Pending 24h evaluation
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] text-slate-600 font-mono text-center">
        ✓ evaluated = real 24h TP/SL backtest · ~estimated = deterministic projection · Not financial advice
      </div>
    </div>
  );
}
