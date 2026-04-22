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
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1d';
  return `${d}d`;
}

/**
 * Vertical timeline of past AI signals. Each entry shows direction,
 * confidence, headline, and an optional mock "outcome" P&L
 */
export function SignalHistory({ signals, loading }: SignalHistoryProps) {
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signal Archive</span>
        <span className="text-[10px] text-slate-600 font-mono">Last {signals.length}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="shimmer h-10 rounded" />
          ))}
        </div>
      ) : (
        <div className="relative pl-5">
          {/* timeline rail */}
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10" />
          {signals.map(sig => {
            const color = DIR_COLORS[sig.direction];
            const positive = (sig.pnlPct ?? 0) >= 0;
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
                  <span className="text-slate-600 ml-auto">{daysAgo(sig.timestamp)} ago</span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">{sig.headline}</p>
                {typeof sig.pnlPct === 'number' && (
                  <span
                    className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: positive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                      color: positive ? '#34D399' : '#F87171',
                      border: `1px solid ${positive ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}
                    title="Mock outcome — demo only"
                  >
                    {positive ? '+' : ''}{sig.pnlPct.toFixed(1)}% on close
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
