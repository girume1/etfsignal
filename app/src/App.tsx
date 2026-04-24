import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DensityProvider } from './contexts/DensityContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { AppShell } from './components/AppShell';
import { LandingPage } from './pages/LandingPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { AboutPage } from './pages/AboutPage';
import OverviewPage  from './pages/app/OverviewPage';
import FlowsPage     from './pages/app/FlowsPage';
import SignalsPage   from './pages/app/SignalsPage';
import AlertsPage    from './pages/app/AlertsPage';
import NewsPage      from './pages/app/NewsPage';

export default function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: 'e75d83bb-29a6-4726-895d-486c91b450e9',
        walletConnectors: [EthereumWalletConnectors],
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
                <DashboardProvider>
                  <AppShell />
                </DashboardProvider>
              }
            >
              <Route index          element={<OverviewPage />} />
              <Route path="flows"   element={<FlowsPage />} />
              <Route path="signals" element={<SignalsPage />} />
              <Route path="alerts"  element={<AlertsPage />} />
              <Route path="news"    element={<NewsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DensityProvider>
      </BrowserRouter>
    </DynamicContextProvider>
  );
}
