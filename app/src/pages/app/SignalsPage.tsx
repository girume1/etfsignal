import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { SentimentGauge } from '../../components/SentimentGauge';
import { SignalPanel } from '../../components/SignalPanel';
import { AskAI } from '../../components/AskAI';
import { SignalHistory } from '../../components/SignalHistory';

// ── How it works steps ────────────────────────────────────────────────────────

const HOW_STEPS = [
  { color: '#00C2FF', text: 'ETF flow data is fetched from SoSoValue across all 10–12 funds per asset.' },
  { color: '#0057FF', text: 'A flow sentiment score (0–100) is computed from inflow momentum and breadth.' },
  { color: '#A78BFA', text: 'Claude AI synthesizes flows + market news into a directional signal.' },
  { color: '#34D399', text: 'You review the signal and optionally execute on SoDEX testnet.' },
];

// ── page ──────────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const {
    activeData, activeLabel, activeTab, setActiveTab,
    sentiment, signal, signalLoading, signalError,
    handleAnalyze, openTradeModal, wallet, history, loading,
    liveBtcPx, liveEthPx,
  } = useDashboard();
  const { density } = useDensity();

  const gap    = density === 'comfortable' ? 'gap-5 p-5' : 'gap-4 p-4';
  const mobile = density === 'mobile';

  const livePx = activeTab === 'btc' ? liveBtcPx : liveEthPx;

  function fmt(n: number | null) {
    if (n == null) return null;
    return n >= 1000
      ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : `$${n.toFixed(2)}`;
  }

  return (
    <div>
      <QuickStats />

      {/* ── Asset tab switcher ─────────────────────────────────────────── */}
      <div
        style={{ borderBottom: '1px solid var(--brand-border)', background: 'var(--brand-panel)' }}
        className="px-4 py-2 flex items-center gap-2"
      >
        {(['btc', 'eth'] as const).map(t => {
          const active = activeTab === t;
          const px = t === 'btc' ? liveBtcPx : liveEthPx;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={
                active
                  ? { background: 'var(--brand-blue)', color: 'white' }
                  : { color: '#94A3B8', border: '1px solid var(--brand-border)' }
              }
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors uppercase tracking-wider flex items-center gap-2"
            >
              {t.toUpperCase()} Signal
              {px != null && (
                <span
                  className="text-[10px] font-mono"
                  style={{ color: active ? 'rgba(255,255,255,0.7)' : '#64748B' }}
                >
                  {fmt(px)}
                </span>
              )}
            </button>
          );
        })}

        {/* Live price pill */}
        {livePx != null && (
          <span
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
            className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* ── Hero analyze card (shown when no signal) ───────────────────── */}
      {!signal && !signalLoading && (
        <div className={`${gap} max-w-screen-2xl mx-auto w-full`}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,255,0.15) 0%, rgba(0,194,255,0.08) 100%)',
              border: '1px solid rgba(0,87,255,0.3)',
              boxShadow: '0 0 40px rgba(0,87,255,0.1)',
            }}
            className="rounded-2xl p-8 flex flex-col items-center text-center gap-5"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'rgba(0,87,255,0.15)', border: '1px solid rgba(0,87,255,0.3)' }}
            >
              ✦
            </div>
            <div>
              <h2 className="font-display text-white text-xl font-bold mb-1">
                Generate {activeLabel} AI Signal
              </h2>
              <p className="text-slate-400 text-sm max-w-md">
                Claude reads live ETF flow data, inflow momentum, and recent news to synthesize
                a structured directional signal with trade idea.
              </p>
            </div>

            {/* Steps preview */}
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
              {HOW_STEPS.map((s, i) => (
                <div
                  key={i}
                  style={{ background: `${s.color}10`, border: `1px solid ${s.color}30` }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                >
                  <span
                    style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-slate-400" style={{ maxWidth: 160 }}>
                    {s.text.split('.')[0]}.
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleAnalyze}
              style={{
                background: 'linear-gradient(135deg, #0057FF 0%, #00C2FF 100%)',
                boxShadow: '0 0 24px rgba(0,87,255,0.4)',
              }}
              className="px-8 py-3.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <span className="text-base">✦</span>
              Analyze {activeLabel} ETF Flows Now
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'} ${gap} max-w-screen-2xl mx-auto w-full`}>

        {/* Left: Gauge + Signal + AskAI */}
        <div className={`${mobile ? '' : 'lg:col-span-7'} flex flex-col gap-4`}>
          <SentimentGauge sentiment={sentiment} asset={activeLabel} />
          <SignalPanel
            signal={signal} loading={signalLoading}
            onAnalyze={handleAnalyze} activeTab={activeTab}
            onTrade={openTradeModal} walletConnected={wallet.connected}
            error={signalError}
          />
          {signal && (
            <AskAI asset={activeLabel} etfData={activeData} signal={signal} />
          )}
        </div>

        {/* Right: How it works + Signal history */}
        <div className={`${mobile ? '' : 'lg:col-span-5'} flex flex-col gap-4`}>
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="rounded-xl p-4"
          >
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 font-mono flex items-center gap-2">
              <span>⚙</span> How AI Signals Work
            </div>
            <div className="space-y-3">
              {HOW_STEPS.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                    className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-mono shrink-0 mt-0.5"
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <SignalHistory signals={history} loading={loading} />

          {/* AskAI shown in sidebar when no signal yet */}
          {!signal && !signalLoading && (
            <AskAI asset={activeLabel} etfData={activeData} signal={signal} />
          )}
        </div>

      </div>
    </div>
  );
}
