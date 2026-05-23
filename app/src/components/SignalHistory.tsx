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
const DIR_ICONS: Record<HistoricalSignal['direction'], string> = {
  BULLISH: '↑',
  BEARISH: '↓',
  NEUTRAL: '→',
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
 * Deterministic mock PnL for demo purposes — stable across page loads.
 * Uses the signal id as a seed so the number doesn't change on re-render.
 */
function mockPnl(sig: HistoricalSignal): number {
  // Only assign mock outcome to signals older than 30 minutes
  if (Date.now() - sig.timestamp < 30 * 60 * 1000) return NaN;

  // Hash the id string into a stable pseudo-random in [0, 1)
  let h = 0;
  for (let i = 0; i < sig.id.length; i++) {
    h = (Math.imul(31, h) + sig.id.charCodeAt(i)) | 0;
  }
  const rand = Math.abs(h) / 2147483647;

  // High-confidence signals are more likely to hit
  const hitProb = 0.45 + (sig.confidence / 100) * 0.35; // 45–80%
  const hit = rand < hitProb;

  if (hit) {
    // +1% to +8%, scaled by confidence
    return +(1 + rand * 7 * (sig.confidence / 100)).toFixed(1);
  } else {
    // -1% to -4%
    return -(1 + rand * 3).toFixed(1) as unknown as number;
  }
}

/** Compute performance stats across all resolved signals */
function computeStats(signals: HistoricalSignal[]) {
  const resolved = signals.map(s => {
    const pnl = typeof s.pnlPct === 'number' ? s.pnlPct : mockPnl(s);
    return isNaN(pnl) ? null : pnl;
  }).filter((p): p is number => p !== null);

  if (resolved.length === 0) return null;

  const wins = resolved.filter(p => p > 0).length;
  const hitRate = Math.round((wins / resolved.length) * 100);
  const avgPnl = resolved.reduce((a, b) => a + b, 0) / resolved.length;

  return { total: resolved.length, hitRate, avgPnl };
}

/**
 * Vertical timeline of past AI signals with performance summary.
 * Each entry shows direction, confidence, headline, and an outcome P&L.
 */
export function SignalHistory({ signals, loading }: SignalHistoryProps) {
  const stats = !loading ? computeStats(signals) : null;

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signal Archive</span>
        <span className="text-[10px] text-slate-600 font-mono">Last {signals.length}</span>
      </div>

      {/* Performance summary bar */}
      {stats && (
        <div
          className="grid grid-cols-3 gap-2 mb-3 rounded-lg p-2.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-mono mb-0.5">RESOLVED</div>
            <div className="text-sm font-bold text-slate-200 font-mono">{stats.total}</div>
          </div>
          <div className="text-center border-x border-white/5">
            <div className="text-[10px] text-slate-500 font-mono mb-0.5">HIT RATE</div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: stats.hitRate >= 50 ? '#34D399' : '#F87171' }}
            >
              {stats.hitRate}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 font-mono mb-0.5">AVG P&amp;L</div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: stats.avgPnl >= 0 ? '#34D399' : '#F87171' }}
            >
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

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
            const color = DIR_COLORS[sig.direction];
            const pnl = typeof sig.pnlPct === 'number' ? sig.pnlPct : mockPnl(sig);
            const hasPnl = !isNaN(pnl);
            const positive = pnl >= 0;
            return (
              <div key={sig.id} className="relative mb-3 last:mb-0">
                <span
                  className="absolute -left-[15px] top-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: color, boxShadow: `0 0 0 3px var(--brand-card), 0 0 8px ${color}66` }}
                />
                <div className="flex items-center gap-2 text-[11px] font-mono mb-0.5">
                  <span style={{ color }} className="font-semibold uppercase tracking-widest">
                    {DIR_ICONS[sig.direction]} {sig.direction}
                  </span>
                  <span className="text-slate-500">· {sig.asset}</span>
                  <span className="text-slate-600">· {sig.confidence}%</span>
                  <span className="text-slate-600 ml-auto">{daysAgo(sig.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">{sig.headline}</p>
                {hasPnl && (
                  <span
                    className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: positive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                      color: positive ? '#34D399' : '#F87171',
                      border: `1px solid ${positive ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}
                    title="Simulated testnet outcome — demo only"
                  >
                    {positive ? '+' : ''}{pnl.toFixed(1)}% simulated
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] text-slate-600 font-mono text-center">
        Simulated outcomes — testnet demo only · Not financial advice
      </div>
    </div>
  );
}
