import { DynamicContextProvider, mergeNetworks } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DensityProvider } from './contexts/DensityContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ConnectionStatusProvider } from './contexts/ConnectionStatusContext';
import { AppShell } from './components/AppShell';
import {
  CHAIN_ID,
  VALUECHAIN_DYNAMIC_NETWORK,
  type DynamicEvmNetwork,
} from './config/valuechain';
import { isWalletLockedError, WALLET_LOCKED_MESSAGE } from './services/walletNetwork';
import { LandingPage } from './pages/LandingPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { AboutPage } from './pages/AboutPage';
import OverviewPage  from './pages/app/OverviewPage';
import FlowsPage     from './pages/app/FlowsPage';
import SignalsPage   from './pages/app/SignalsPage';
import AlertsPage    from './pages/app/AlertsPage';
import NewsPage      from './pages/app/NewsPage';
import TradePage     from './pages/app/TradePage';
import WatchlistPage from './pages/app/WatchlistPage';
import PortfolioPage from './pages/app/PortfolioPage';
import SettingsPage  from './pages/app/SettingsPage';

// Memoized at module scope per Dynamic SDK SettingsOverrides requirements
const mergeValueChainNetworks = (dashboardNetworks: DynamicEvmNetwork[]): DynamicEvmNetwork[] =>
  mergeNetworks([VALUECHAIN_DYNAMIC_NETWORK], dashboardNetworks);

const WALLETCONNECT_PREFERRED_CHAINS: `eip155:${number}`[] = [`eip155:${CHAIN_ID}`];

export default function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID!,
        walletConnectors: [EthereumWalletConnectors],
        walletConnectPreferredChains: WALLETCONNECT_PREFERRED_CHAINS,
        overrides: {
          evmNetworks: mergeValueChainNetworks,
        },
        events: {
          onWalletConnectionFailed: (_connector, error) => {
            if (isWalletLockedError(error)) {
              window.dispatchEvent(
                new CustomEvent('etfsignal:wallet-locked', { detail: WALLET_LOCKED_MESSAGE }),
              );
            }
          },
        },
      }}
    >
      <BrowserRouter>
        <DensityProvider>
          <Routes>
            {/* Marketing pages */}
            <Route path="/"             element={<LandingPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about"        element={<AboutPage />} />

            {/* App — all sub-routes share DashboardProvider + AppShell */}
            <Route
              path="/app"
              element={
                <ConnectionStatusProvider>
                  <DashboardProvider>
                    <AppShell />
                  </DashboardProvider>
                </ConnectionStatusProvider>
              }
            >
              <Route index          element={<OverviewPage />} />
              <Route path="flows"   element={<FlowsPage />} />
              <Route path="signals" element={<SignalsPage />} />
              <Route path="trade"   element={<TradePage />} />
              <Route path="alerts"    element={<AlertsPage />} />
              <Route path="news"      element={<NewsPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="settings"  element={<SettingsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DensityProvider>
      </BrowserRouter>
    </DynamicContextProvider>
  );
}
