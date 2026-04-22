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

export default function OverviewPage() {
  const {
    btcData, ethData, btcHist, ethHist, activeData, activeHist, activePrice,
    activeLabel, activeTab, setActiveTab, loading, sentiment,
    signal, signalLoading, signalError, handleAnalyze,
    alerts, history, news, refresh,
    openTradeModal, wallet,
  } = useDashboard();
  const { density } = useDensity();

  const mobile = density === 'mobile';
  const gap    = density === 'comfortable' ? 'gap-5 p-5' : 'gap-4 p-4';

  return (
    <div>
      <QuickStats />
      <div className={`grid grid-cols-12 ${gap} max-w-screen-2xl mx-auto w-full`}>

        {/* ── LEFT · Market intelligence ─────────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-5'} flex flex-col gap-4`}>
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

        {/* ── CENTER · Signal + AI ───────────────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-4'} flex flex-col gap-4`}>
          <SentimentGauge sentiment={sentiment} asset={activeLabel} />
          <SignalPanel
            signal={signal} loading={signalLoading}
            onAnalyze={handleAnalyze} activeTab={activeTab}
            onTrade={openTradeModal} walletConnected={wallet.connected}
            error={signalError}
          />
          <AskAI asset={activeLabel} etfData={activeData} signal={signal} />
        </div>

        {/* ── RIGHT · Alerts, archive, news ─────────────────────── */}
        <div className={`${mobile ? 'col-span-12' : 'col-span-12 lg:col-span-3'} flex flex-col gap-4`}>
          <AlertsPanel alerts={alerts} loading={loading} />
          <SignalHistory signals={history} loading={loading} />
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Market News</span>
            <button
              onClick={refresh} disabled={loading}
              style={{ color: 'var(--brand-accent)', border: '1px solid rgba(0,194,255,0.3)' }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium hover:bg-white/5 disabled:opacity-40"
            >
              ↻ Refresh
            </button>
          </div>
          <NewsFeed news={news} loading={loading} />
          <div style={{ border: '1px solid var(--brand-border)' }} className="rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-600">
              Data by{' '}
              <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--brand-accent)' }} className="hover:underline">SoSoValue</a>
              {' '}· Trading on{' '}
              <a href="https://sodex.com" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--brand-accent)' }} className="hover:underline">SoDEX Testnet</a>
              {' '}· AI by Anthropic Claude
            </p>
            <p className="text-[10px] text-slate-700 mt-1">Not financial advice · Testnet only</p>
          </div>
        </div>

      </div>
    </div>
  );
}
