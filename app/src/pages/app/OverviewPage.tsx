import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { EtfPanel } from '../../components/EtfPanel';
import { PriceFlowChart } from '../../components/PriceFlowChart';
import { MarketShareDonut } from '../../components/MarketShareDonut';
import { SentimentGauge } from '../../components/SentimentGauge';
import { SignalPanel } from '../../components/SignalPanel';
import { AskAI } from '../../components/AskAI';
import { AlertsPanel } from '../../components/AlertsPanel';
import { SignalHistory } from '../../components/SignalHistory';
import { NewsFeed } from '../../components/NewsFeed';

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

export default function OverviewPage() {
  const {
    btcData, ethData, btcHist, ethHist,
    activeData, activeHist, activePrice,
    activeLabel, activeTab, setActiveTab,
    latestBtcPx, latestEthPx, liveBtcPx, liveEthPx,
    loading, lastUpdated, sentiment,
    signal, signalLoading, signalError, handleAnalyze,
    alerts, history, news, refresh,
    openTradeModal, wallet,
  } = useDashboard();
  const { density } = useDensity();

  const mobile      = density === 'mobile';
  const comfortable = density === 'comfortable';
  const gap         = comfortable ? 'gap-5 p-5' : 'gap-4 p-4';

  return (
    <div>
      {/* ── Hero banner ──────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 py-5"
        style={{
          background: 'linear-gradient(135deg, rgba(0,87,255,0.12) 0%, rgba(0,194,255,0.05) 50%, rgba(167,139,250,0.08) 100%)',
          borderBottom: '1px solid rgba(0,194,255,0.1)',
        }}
      >
        {/* Grid bg */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" aria-hidden>
          <defs>
            <pattern id="dash-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00C2FF" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dash-grid)" />
        </svg>

        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5 flex items-center gap-2"
               style={{ color: '#00C2FF' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              AI Market Analysis
            </p>
            <h1 className="font-display text-white text-2xl md:text-3xl leading-tight mb-1">
              Smart Signals.{' '}
              <span style={{
                background: 'linear-gradient(135deg, #00C2FF, #A78BFA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Institutional Edge.
              </span>
            </h1>
            <p className="text-slate-400 text-sm">
              ETF flows. News sentiment. On-chain data. AI turns noise into actionable signals.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-[10px] text-slate-600 font-mono hidden lg:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}
              className="px-3 py-1.5 rounded-lg text-xs font-mono hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              onClick={handleAnalyze}
              disabled={signalLoading || !activeData}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #0057FF, #00C2FF)',
                boxShadow: '0 0 16px rgba(0,87,255,0.35)',
              }}
            >
              {signalLoading ? (
                <><span className="animate-spin">↻</span> Analyzing…</>
              ) : (
                <><span>✦</span> Analyze Now</>
              )}
            </button>
          </div>
        </div>
      </div>

      <QuickStats />

      <div className={`grid grid-cols-12 ${gap} max-w-screen-2xl mx-auto w-full`}>

        {/* ── LEFT · Market data ────────────────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-5'} flex flex-col gap-4`}>
          <SectionLabel>ETF Market Data</SectionLabel>
          <EtfPanel
            btcData={btcData} ethData={ethData}
            btcHistory={btcHist} ethHistory={ethHist}
            activeTab={activeTab} onTabChange={setActiveTab}
            loading={loading}
            currentPrice={activeTab === 'btc' ? (liveBtcPx ?? latestBtcPx ?? null) : (liveEthPx ?? latestEthPx ?? null)}
          />
          {activeData && (
            <PriceFlowChart inflows={activeHist} prices={activePrice} asset={activeLabel} />
          )}
          {activeData && (
            <MarketShareDonut funds={activeData.list} asset={activeLabel} />
          )}
        </div>

        {/* ── CENTER · AI signal ────────────────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-4'} flex flex-col gap-4`}>
          <SectionLabel>AI Intelligence</SectionLabel>

          {/* Prompt to analyze — subtle, hero button is now in the top bar */}
          {!signal && !signalLoading && (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(0,87,255,0.07)', border: '1px dashed rgba(0,194,255,0.2)' }}
            >
              <p className="text-slate-400 text-sm mb-3">
                Click <strong className="text-white">Analyze Now</strong> in the header to generate your first {activeLabel} signal.
              </p>
              <button
                onClick={handleAnalyze}
                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                style={{ background: 'rgba(0,87,255,0.25)', color: '#00C2FF', border: '1px solid rgba(0,194,255,0.3)' }}
              >
                ✦ Generate {activeLabel} Signal
              </button>
            </div>
          )}

          <SentimentGauge sentiment={sentiment} asset={activeLabel} />
          <SignalPanel
            signal={signal} loading={signalLoading}
            onAnalyze={handleAnalyze} activeTab={activeTab}
            onTrade={openTradeModal} walletConnected={wallet.connected}
            error={signalError}
          />
          <AskAI asset={activeLabel} etfData={activeData} signal={signal} />
        </div>

        {/* ── RIGHT · Activity feed ─────────────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-3'} flex flex-col gap-4`}>
          <SectionLabel>Activity Feed</SectionLabel>
          <AlertsPanel alerts={alerts} loading={loading} />
          <SignalHistory signals={history} loading={loading} />

          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
              Market News
            </span>
            <button
              onClick={refresh} disabled={loading}
              style={{ color: 'var(--brand-accent)' }}
              className="text-[10px] font-mono hover:underline disabled:opacity-40"
            >
              ↻ refresh
            </button>
          </div>
          <NewsFeed news={news} loading={loading} />

          {/* Footer attribution */}
          <div
            style={{ border: '1px solid var(--brand-border)' }}
            className="rounded-xl p-3 text-center space-y-1"
          >
            <p className="text-[10px] text-slate-600">
              <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer"
                style={{ color: '#475569' }} className="hover:text-white transition-colors">SoSoValue</a>
              {' '}·{' '}
              <a href="https://sodex.com" target="_blank" rel="noopener noreferrer"
                style={{ color: '#475569' }} className="hover:text-white transition-colors">SoDEX Testnet</a>
              {' '}·{' '}
              <span style={{ color: '#475569' }}>Anthropic Claude</span>
            </p>
            <p className="text-[10px] text-slate-700">Not financial advice · Testnet only</p>
          </div>
        </div>

      </div>
    </div>
  );
}
