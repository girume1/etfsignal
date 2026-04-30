import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TickerStrip } from './TickerStrip';
import { DemoBanner } from './DemoBanner';
import { AppSidebar } from './AppSidebar';
import { TradeModal } from './TradeModal';
import { WalletGate } from './WalletGate';
import { useDashboard } from '../contexts/DashboardContext';

export function AppShell() {
  const {
    btcData, ethData,
    latestBtcPx, latestEthPx,
    liveBtcPx, liveEthPx, liveConnected,
    wallet, handleConnectWallet, handleDisconnectWallet,
    lastUpdated, effectiveMock, dataError, refresh,
    signal, symbol, tradeModal, closeTradeModal, confirmTrade,
  } = useDashboard();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-dark)' }}>
      <Header
        wallet={wallet}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        lastUpdated={lastUpdated}
        demoMode={effectiveMock}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
      />

      <TickerStrip
        btcData={btcData} ethData={ethData}
        btcPrice={liveBtcPx ?? latestBtcPx}
        ethPrice={liveEthPx ?? latestEthPx}
        liveConnected={liveConnected}
      />

      {effectiveMock && !bannerDismissed && (
        <DemoBanner onDismiss={() => setBannerDismissed(true)} />
      )}

      {dataError && (
        <div
          style={{ background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.25)' }}
          className="px-6 py-2 flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-red-300 truncate">⚠ {dataError}</span>
          <button
            onClick={refresh}
            className="text-red-200 hover:text-white text-xs font-semibold px-3 py-1 rounded border border-red-400/30 hover:border-red-400/60 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Body: sidebar + page content */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 min-w-0 overflow-y-auto">
          <WalletGate connected={wallet.connected} onConnect={handleConnectWallet}>
            <Outlet />
          </WalletGate>
        </main>
      </div>

      {tradeModal && signal && (
        <TradeModal
          signal={signal} side={tradeModal.side} symbol={symbol}
          onConfirm={confirmTrade} onClose={closeTradeModal}
        />
      )}
    </div>
  );
}
