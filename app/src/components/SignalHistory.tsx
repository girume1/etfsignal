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
 * Only used when a signal is too recent or has no entryPrice.
 */
function mockPnl(sig: HistoricalSignal): number {
  if (Date.now() - sig.timestamp < 30 * 60 * 1000) return NaN;
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

function computeStats(signals: HistoricalSignal[]) {
  const resolved = signals
    .map(s => resolvePnl(s))
    .filter((p): p is { pnl: number; real: boolean } => p !== null);

  if (!resolved.length) return null;

  const wins       = resolved.filter(p => p.pnl > 0).length;
  const hitRate    = Math.round((wins / resolved.length) * 100);
  const avgPnl     = resolved.reduce((a, b) => a + b.pnl, 0) / resolved.length;
  const cumPnl     = resolved.reduce((a, b) => a + b.pnl, 0);
  const realCount  = resolved.filter(p => p.real).length;

  // Drawdown: biggest drop from running peak in cumulative PnL
  let peak = 0, runSum = 0, maxDD = 0;
  for (const { pnl } of resolved) {
    runSum += pnl;
    if (runSum > peak) peak = runSum;
    const dd = peak - runSum;
    if (dd > maxDD) maxDD = dd;
  }

  return { total: resolved.length, hitRate, avgPnl, cumPnl, maxDD, realCount };
}

function buildChartData(signals: HistoricalSignal[]) {
  // Oldest first for cumulative chart
  const ordered = [...signals].reverse();
  let cum = 0;
  return ordered
    .map(s => resolvePnl(s))
    .filter((p): p is { pnl: number; real: boolean } => p !== null)
    .map((p, i) => {
      cum += p.pnl;
      return { i, cum: parseFloat(cum.toFixed(2)), real: p.real };
    });
}

export function SignalHistory({ signals, loading }: SignalHistoryProps) {
  const stats     = !loading ? computeStats(signals) : null;
  const chartData = !loading ? buildChartData(signals) : [];
  const chartColor = stats && stats.cumPnl >= 0 ? '#34D399' : '#F87171';

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

      {/* Performance stats */}
      {stats && (
        <div
          className="grid grid-cols-4 gap-1 mb-3 rounded-lg p-2.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[
            { label: 'RESOLVED', value: stats.total.toString(), color: '#94A3B8' },
            { label: 'WIN RATE', value: `${stats.hitRate}%`, color: stats.hitRate >= 50 ? '#34D399' : '#F87171' },
            { label: 'AVG P&L', value: `${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(1)}%`, color: stats.avgPnl >= 0 ? '#34D399' : '#F87171' },
            { label: 'CUMUL.', value: `${stats.cumPnl >= 0 ? '+' : ''}${stats.cumPnl.toFixed(1)}%`, color: chartColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-[9px] text-slate-600 font-mono mb-0.5 tracking-wider">{label}</div>
              <div className="text-xs font-bold font-mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cumulative PnL sparkline */}
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
                dot={false}
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
                {outcome && (
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
                      {outcome.real ? '✓ evaluated' : 'simulated'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] text-slate-600 font-mono text-center">
        ✓ evaluated = 24h real price · simulated = deterministic demo · Not financial advice
      </div>
    </div>
  );
}
