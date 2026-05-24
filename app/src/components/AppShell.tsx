import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { TradeModal } from './TradeModal';
import { WalletGate } from './WalletGate';
import { useDashboard } from '../contexts/DashboardContext';
import { RefreshCw } from 'lucide-react';

export function AppShell() {
  const {
    wallet, handleConnectWallet, handleDisconnectWallet,
    lastUpdated, dataError, refresh,
    signal, symbol, tradeModal, closeTradeModal, confirmTrade,
    liveBtcPx, liveEthPx, latestBtcPx, latestEthPx, activeTab,
  } = useDashboard();

  const currentPrice = activeTab === 'btc'
    ? (liveBtcPx ?? latestBtcPx ?? null)
    : (liveEthPx ?? latestEthPx ?? null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

      {/* ── Body: sidebar + main ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 min-w-0 overflow-y-auto">
          <WalletGate connected={wallet.connected} onConnect={handleConnectWallet}>
            <Outlet />
          </WalletGate>
        </main>
      </div>

      {/* ── Trade modal ──────────────────────────────────────── */}
      {tradeModal && signal && (
        <TradeModal
          signal={signal} side={tradeModal.side} symbol={symbol}
          walletAddress={wallet.address}
          currentPrice={currentPrice ?? undefined}
          onConfirm={confirmTrade} onClose={closeTradeModal}
        />
      )}
    </div>
  );
}
