import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { TradeModal } from './TradeModal';
import { WalletGate } from './WalletGate';
import { OnboardingTour } from './OnboardingTour';
import { shouldShowTour } from '../utils/onboardingTour';
import { useDashboard } from '../contexts/dashboardStore';
import { RefreshCw } from 'lucide-react';

export function AppShell() {
  const {
    wallet, handleConnectWallet, handleDisconnectWallet, switchToValueChain,
    lastUpdated, dataError, refresh,
    signal, symbol, tradeModal, closeTradeModal, confirmTrade, signer,
    liveBtcPx, liveEthPx, latestBtcPx, latestEthPx, activeTab,
  } = useDashboard();

  const currentPrice = activeTab === 'btc'
    ? (liveBtcPx ?? latestBtcPx ?? null)
    : (liveEthPx ?? latestEthPx ?? null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTour, setShowTour] = useState(shouldShowTour);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-dark)' }}>

      {/* ── Full-width sticky header ─────────────────────────── */}
      <Header
        wallet={wallet}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        lastUpdated={lastUpdated}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
      />

      {/* ── Error bar ───────────────────────────────────────── */}
      {dataError && (
        <div
          style={{ background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}
          className="px-5 py-2 flex items-center justify-between gap-4 text-sm z-40"
        >
          <span className="text-red-300 text-xs truncate">⚠ {dataError}</span>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-red-200 hover:text-white text-xs font-semibold px-3 py-1 rounded-lg border border-red-400/30 hover:border-red-400/60 transition-colors shrink-0"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {/* ── Locked wallet banner ────────────────────────────── */}
      {wallet.connected && wallet.networkStatus === 'locked' && (
        <div
          style={{ background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.22)' }}
          className="px-5 py-2 flex items-center justify-between gap-4 text-sm z-40"
        >
          <span className="text-amber-300 text-xs truncate">
            {wallet.networkError ?? 'Unlock your wallet to connect to ValueChain and sign orders.'}
          </span>
          <button
            onClick={() => void switchToValueChain?.()}
            className="flex items-center gap-1.5 text-amber-200 hover:text-white text-xs font-semibold px-3 py-1 rounded-lg border border-amber-400/30 hover:border-amber-400/60 transition-colors shrink-0"
          >
            <RefreshCw size={11} />
            Unlock wallet · Retry
          </button>
        </div>
      )}

      {/* ── Body: sidebar + main ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 min-w-0 overflow-y-auto">
          <WalletGate connected={wallet.connected} onConnect={handleConnectWallet}>
            <Outlet />
          </WalletGate>
        </main>
      </div>

      {/* ── First-visit onboarding tour ──────────────────────── */}
      {wallet.connected && showTour && (
        <OnboardingTour onDone={() => setShowTour(false)} />
      )}

      {/* ── Trade modal ──────────────────────────────────────── */}
      {tradeModal && (
        <TradeModal
          signal={signal} side={tradeModal.side} symbol={symbol}
          walletAddress={wallet.address}
          walletChainId={wallet.chainId}
          walletNetworkStatus={wallet.networkStatus}
          onSwitchNetwork={switchToValueChain}
          currentPrice={currentPrice ?? undefined}
          signer={signer}
          onConfirm={confirmTrade} onClose={closeTradeModal}
        />
      )}
    </div>
  );
}
