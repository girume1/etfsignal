import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { EtfPanel } from '../../components/EtfPanel';
import { PriceFlowChart } from '../../components/PriceFlowChart';
import { MarketShareDonut } from '../../components/MarketShareDonut';

export default function FlowsPage() {
  const {
    btcData, ethData, btcHist, ethHist, btcPrice, ethPrice,
    activeTab, setActiveTab, loading,
  } = useDashboard();
  const { density } = useDensity();

  const gap = density === 'comfortable' ? 'gap-5 p-5' : 'gap-4 p-4';
  const mobile = density === 'mobile';

  return (
    <div>
      <QuickStats />

      <div className={`${gap} max-w-screen-2xl mx-auto`}>
        {/* Asset selector + ETF breakdown — full width */}
        <EtfPanel
          btcData={btcData} ethData={ethData}
          btcHistory={btcHist} ethHistory={ethHist}
          activeTab={activeTab} onTabChange={setActiveTab}
          loading={loading}
        />

        {/* Side-by-side charts (or stacked on mobile) */}
        <div className={`mt-4 grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-4`}>
          {/* BTC */}
          {btcData && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <span
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                  className="text-xs px-2.5 py-1 rounded-full font-mono uppercase tracking-wider"
                >
                  BTC Flows
                </span>
              </div>
              <PriceFlowChart inflows={btcHist} prices={btcPrice} asset="BTC" />
              <MarketShareDonut funds={btcData.list} asset="BTC" />
            </div>
          )}

          {/* ETH */}
          {ethData && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <span
                  style={{ background: 'rgba(129,140,248,0.12)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.3)' }}
                  className="text-xs px-2.5 py-1 rounded-full font-mono uppercase tracking-wider"
                >
                  ETH Flows
                </span>
              </div>
              <PriceFlowChart inflows={ethHist} prices={ethPrice} asset="ETH" />
              <MarketShareDonut funds={ethData.list} asset="ETH" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
