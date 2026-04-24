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
      {/* ── Page header ────────────────────────────────────────── */}
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="px-5 py-3 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white uppercase tracking-widest font-mono">
            Market Overview
          </span>
          <span
            style={{ background: 'rgba(0,87,255,0.12)', color: '#60A5FA', border: '1px solid rgba(0,87,255,0.25)' }}
            className="text-[10px] px-2 py-0.5 rounded font-mono"
          >
            COCKPIT
          </span>
          {lastUpdated && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
            Data by SoSoValue · AI by Claude · Trade on SoDEX
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            style={{ border: '1px solid var(--brand-border)', color: '#64748B' }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-mono hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
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

          {/* Analyze CTA — prominent hero button when no signal yet */}
          {!signal && !signalLoading && (
            <button
              onClick={handleAnalyze}
              style={{
                background: 'linear-gradient(135deg, #0057FF 0%, #00C2FF 100%)',
                boxShadow: '0 0 24px rgba(0,87,255,0.35)',
              }}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <span className="text-base">✦</span>
              Generate {activeLabel} AI Signal
            </button>
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
