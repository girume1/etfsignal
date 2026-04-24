import type { MarketSignal, ActiveTab } from '../types';

interface SignalPanelProps {
  signal: MarketSignal | null;
  loading: boolean;
  onAnalyze: () => void;
  activeTab: ActiveTab;
  onTrade: (side: 'BUY' | 'SELL') => void;
  walletConnected: boolean;
  error?: string | null;
}

const DIRECTION_STYLES = {
  BULLISH: {
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.3)',
    badge: '#34D399',
    badgeBg: 'rgba(52,211,153,0.15)',
    icon: '↑',
    glow: 'rgba(52,211,153,0.15)',
  },
  BEARISH: {
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.3)',
    badge: '#F87171',
    badgeBg: 'rgba(248,113,113,0.15)',
    icon: '↓',
    glow: 'rgba(248,113,113,0.15)',
  },
  NEUTRAL: {
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)',
    badge: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.15)',
    icon: '→',
    glow: 'rgba(148,163,184,0.1)',
  },
};

const PREVIEW_FEATURES = [
  { icon: '⬆', label: 'BULLISH / BEARISH / NEUTRAL direction' },
  { icon: '◆', label: '3 key institutional flow drivers' },
  { icon: '⚡', label: 'Actionable trade idea + risk warning' },
];

export function SignalPanel({
  signal, loading, onAnalyze, activeTab,
  onTrade, walletConnected, error,
}: SignalPanelProps) {
  const label = activeTab.toUpperCase();
  const style = signal ? DIRECTION_STYLES[signal.direction] : null;

  return (
    <div className="flex flex-col gap-3">

      {/* Error state */}
      {error && !loading && (
        <div
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)' }}
          className="rounded-xl p-4"
        >
          <div className="text-red-300 font-semibold text-sm mb-1">⚠ Analysis failed</div>
          <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
          <button
            onClick={onAnalyze}
            className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-400/30 hover:border-red-400/60 text-red-200 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state — no signal yet */}
      {!signal && !loading && !error && (
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-5 flex flex-col gap-4"
        >
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.25)' }}
            >
              <span className="text-xl" style={{ color: 'var(--brand-blue)' }}>✦</span>
            </div>
            <p className="text-slate-300 text-sm font-medium">No signal yet</p>
            <p className="text-slate-500 text-xs mt-1">
              Claude will synthesize live {label} ETF flows and news into a structured signal
            </p>
          </div>

          {/* Feature preview */}
          <div
            style={{ background: 'rgba(0,87,255,0.05)', border: '1px dashed rgba(0,87,255,0.2)' }}
            className="rounded-lg p-3 space-y-2"
          >
            {PREVIEW_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-slate-500">
                <span style={{ color: 'rgba(0,194,255,0.5)' }}>{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>

          <button
            onClick={onAnalyze}
            style={{ background: 'var(--brand-blue)' }}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
          >
            ✦ Analyze {label}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-8 flex flex-col items-center justify-center gap-4"
        >
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-base">✦</div>
          </div>
          <div className="text-center">
            <p className="text-slate-300 text-sm font-medium">Synthesizing signal…</p>
            <p className="text-slate-500 text-xs mt-1">Reading ETF flows + news with Claude AI</p>
          </div>
        </div>
      )}

      {/* Signal result */}
      {signal && style && !loading && (
        <div
          style={{
            background: style.bg,
            border: `1px solid ${style.border}`,
            boxShadow: `0 0 32px ${style.glow}`,
          }}
          className="rounded-xl p-5 flex flex-col gap-4 slide-up"
        >
          {/* Direction + confidence */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span
              style={{ background: style.badgeBg, color: style.badge, border: `1px solid ${style.border}` }}
              className="text-sm font-bold px-3 py-1 rounded-full font-mono tracking-widest flex items-center gap-2"
            >
              <span>{style.icon}</span>
              {signal.direction}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">CONFIDENCE</span>
              <div className="flex gap-0.5">
                {Array(10).fill(0).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-3.5 rounded-sm"
                    style={{
                      background: i < Math.round(signal.confidence / 10)
                        ? style.badge
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: style.badge }}>
                {signal.confidence}%
              </span>
            </div>
          </div>

          {/* Headline */}
          <h3 className="font-display text-white text-lg leading-snug">{signal.headline}</h3>

          {/* Summary */}
          <p className="text-slate-300 text-sm leading-relaxed">{signal.summary}</p>

          {/* Key Factors */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono">
              Key Factors
            </div>
            <ul className="space-y-1.5">
              {signal.keyFactors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span style={{ color: style.badge }} className="mt-0.5 text-xs shrink-0">◆</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Trade idea */}
          <div
            style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.25)' }}
            className="rounded-lg p-3"
          >
            <div className="text-[10px] font-semibold text-blue-400 mb-1 uppercase tracking-wider font-mono">
              ⚡ Trade Idea
            </div>
            <p className="text-sm text-slate-200">{signal.tradeIdea}</p>
          </div>

          {/* Risk warning */}
          <div
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
            className="rounded-lg p-3"
          >
            <div className="text-[10px] font-semibold text-yellow-500 mb-1 uppercase tracking-wider font-mono">
              ⚠ Risk
            </div>
            <p className="text-xs text-slate-400">{signal.riskWarning}</p>
          </div>

          {/* Trade buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onTrade('BUY')}
              disabled={!walletConnected}
              style={{
                background: walletConnected ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.05)',
                border: '1px solid rgba(52,211,153,0.35)',
              }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-green-400 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↑ Long {label}
            </button>
            <button
              onClick={() => onTrade('SELL')}
              disabled={!walletConnected}
              style={{
                background: walletConnected ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.05)',
                border: '1px solid rgba(248,113,113,0.35)',
              }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-red-400 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓ Short {label}
            </button>
          </div>

          {!walletConnected && (
            <p className="text-[10px] text-center text-slate-600 font-mono">
              Connect wallet to trade on SoDEX testnet
            </p>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-1 border-t border-white/5">
            <span>{signal.timestamp.toLocaleTimeString()}</span>
            <span>Not financial advice</span>
          </div>
        </div>
      )}

      {/* Re-analyze button after signal is shown */}
      {signal && !loading && (
        <button
          onClick={onAnalyze}
          style={{ border: '1px solid var(--brand-border)', color: '#64748B' }}
          className="w-full py-2 rounded-lg text-xs font-mono hover:text-white hover:bg-white/5 transition-colors"
        >
          ↻ Re-analyze {label}
        </button>
      )}
    </div>
  );
}
