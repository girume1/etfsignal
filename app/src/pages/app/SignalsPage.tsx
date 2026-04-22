import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { SentimentGauge } from '../../components/SentimentGauge';
import { SignalPanel } from '../../components/SignalPanel';
import { AskAI } from '../../components/AskAI';
import { SignalHistory } from '../../components/SignalHistory';

export default function SignalsPage() {
  const {
    activeData, activeLabel, activeTab, setActiveTab,
    sentiment, signal, signalLoading, signalError,
    handleAnalyze, openTradeModal, wallet, history, loading,
  } = useDashboard();
  const { density } = useDensity();

  const gap    = density === 'comfortable' ? 'gap-5 p-5' : 'gap-4 p-4';
  const mobile = density === 'mobile';

  return (
    <div>
      <QuickStats />

      {/* Asset tab switcher */}
      <div
        style={{ borderBottom: '1px solid var(--brand-border)', background: 'var(--brand-panel)' }}
        className="px-4 py-2 flex items-center gap-2"
      >
        {(['btc', 'eth'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={
              activeTab === t
                ? { background: 'var(--brand-blue)', color: 'white' }
                : { color: '#94A3B8', border: '1px solid var(--brand-border)' }
            }
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors uppercase tracking-wider"
          >
            {t.toUpperCase()} Signal
          </button>
        ))}
      </div>

      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'} ${gap} max-w-screen-2xl mx-auto`}>

        {/* Gauge + Signal — main column */}
        <div className={`${mobile ? '' : 'lg:col-span-7'} flex flex-col gap-4`}>
          <SentimentGauge sentiment={sentiment} asset={activeLabel} />
          <SignalPanel
            signal={signal} loading={signalLoading}
            onAnalyze={handleAnalyze} activeTab={activeTab}
            onTrade={openTradeModal} walletConnected={wallet.connected}
            error={signalError}
          />
          <AskAI asset={activeLabel} etfData={activeData} signal={signal} />
        </div>

        {/* Signal history — right column */}
        <div className={`${mobile ? '' : 'lg:col-span-5'} flex flex-col gap-4`}>
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="rounded-xl p-4"
          >
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              How AI Signals Work
            </div>
            <div className="space-y-3">
              {[
                { step: '1', color: '#00C2FF', text: 'ETF flow data is fetched from SoSoValue across all 10–12 funds per asset.' },
                { step: '2', color: '#0057FF', text: 'A flow sentiment score (0–100) is computed from inflow momentum and breadth.' },
                { step: '3', color: '#A78BFA', text: 'Claude AI synthesizes flows + market news into a directional signal.' },
                { step: '4', color: '#34D399', text: 'You review the signal and optionally execute on SoDEX testnet.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <span
                    style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}
                    className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-mono shrink-0 mt-0.5"
                  >
                    {s.step}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
          <SignalHistory signals={history} loading={loading} />
        </div>

      </div>
    </div>
  );
}
