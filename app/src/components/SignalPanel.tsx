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
  },
  BEARISH: {
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.3)',
    badge: '#F87171',
    badgeBg: 'rgba(248,113,113,0.15)',
    icon: '↓',
  },
  NEUTRAL: {
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)',
    badge: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.15)',
    icon: '→',
  },
};

export function SignalPanel({ signal, loading, onAnalyze, activeTab, onTrade, walletConnected, error }: SignalPanelProps) {
  const label = activeTab.toUpperCase();
  const style = signal ? DIRECTION_STYLES[signal.direction] : null;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-white text-xl">AI Signal</h2>
        <button
          onClick={onAnalyze}
          disabled={loading}
          style={{ background: loading ? 'rgba(0,87,255,0.3)' : 'var(--brand-blue)' }}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>✦ Analyze {label}</>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)' }}
          className="rounded-xl p-4 text-sm"
        >
          <div className="text-red-300 font-semibold mb-1">⚠ Analysis failed</div>
          <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
          <button
            onClick={onAnalyze}
            className="mt-3 text-xs font-semibold px-3 py-1 rounded border border-red-400/30 hover:border-red-400/60 text-red-200 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Signal Card */}
      {!signal && !loading && !error && (
        <div
          style={{ background: 'var(--brand-card)', border: '1px dashed var(--brand-border)' }}
          className="rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 flex-1 min-h-64"
        >
          <div className="text-4xl opacity-30">✦</div>
          <p className="text-slate-500 text-sm">
            Click "Analyze {label}" to generate an AI-powered market signal<br />
            from live ETF flow data and recent news
          </p>
        </div>
      )}

      {loading && (
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-8 flex flex-col items-center justify-center gap-4 flex-1 min-h-64"
        >
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Synthesizing ETF flows + news...</p>
        </div>
      )}

      {signal && style && !loading && (
        <div
          style={{ background: style.bg, border: `1px solid ${style.border}` }}
          className="rounded-xl p-5 slide-up signal-glow flex-1 flex flex-col gap-4"
        >
          {/* Direction badge */}
          <div className="flex items-center justify-between">
            <span
              style={{ background: style.badgeBg, color: style.badge, border: `1px solid ${style.border}` }}
              className="text-sm font-bold px-3 py-1 rounded-full font-mono tracking-widest flex items-center gap-2"
            >
              <span className="text-base">{style.icon}</span>
              {signal.direction}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence</span>
              <div className="flex gap-0.5">
                {Array(10).fill(0).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-4 rounded-sm"
                    style={{
                      background: i < Math.round(signal.confidence / 10)
                        ? style.badge
                        : 'rgba(255,255,255,0.1)'
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono" style={{ color: style.badge }}>{signal.confidence}%</span>
            </div>
          </div>

          {/* Headline */}
          <h3 className="font-display text-white text-xl leading-snug">{signal.headline}</h3>

          {/* Summary */}
          <p className="text-slate-300 text-sm leading-relaxed">{signal.summary}</p>

          {/* Key Factors */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Factors</div>
            <ul className="space-y-1.5">
              {signal.keyFactors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span style={{ color: style.badge }} className="mt-0.5 text-xs">◆</span>
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
            <div className="text-xs font-semibold text-blue-400 mb-1 uppercase tracking-wider">Trade Idea</div>
            <p className="text-sm text-slate-200">{signal.tradeIdea}</p>
          </div>

          {/* Risk warning */}
          <div
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
            className="rounded-lg p-3"
          >
            <div className="text-xs font-semibold text-yellow-500 mb-1 uppercase tracking-wider">⚠ Risk</div>
            <p className="text-xs text-slate-400">{signal.riskWarning}</p>
          </div>

          {/* Trade buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onTrade('BUY')}
              disabled={!walletConnected}
              style={{ background: walletConnected ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.3)' }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-green-400 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Long {label} / USDT
            </button>
            <button
              onClick={() => onTrade('SELL')}
              disabled={!walletConnected}
              style={{ background: walletConnected ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.3)' }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-red-400 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Short {label} / USDT
            </button>
          </div>
          {!walletConnected && (
            <p className="text-xs text-center text-slate-500">Connect wallet to trade on SoDEX testnet</p>
          )}

          <p className="text-xs text-slate-600 text-center">
            {signal.timestamp.toLocaleTimeString()} · This is not financial advice
          </p>
        </div>
      )}
    </div>
  );
}
