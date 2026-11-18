/**
 * Phase 5 end-to-end integration tests:
 *  - Fallback signals never archived, broadcast to Telegram, or counted in stats
 *  - Discord #1: Buy/Sell works end-to-end via DashboardContext when /api/analyze returns 503
 *  - Discord #2: Connected wallet on Ethereum renders the Header switch pill and switches to ValueChain
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ACTIVE_VALUECHAIN } from '../config/valuechain';
import { resetAiCircuitBreaker } from '../services/ai';
import { saveSignal, evaluatePendingSignals } from '../services/signalArchive';
import {
  computeRealStats,
  computeEstimatedStats,
  countResolved,
  buildRealChartData,
} from '../utils/signalStats';
import type { HistoricalSignal } from '../types';
import type { DynamicWalletLike, Eip1193Provider } from '../services/walletNetwork';

const mockDynamicState: {
  primaryWallet: DynamicWalletLike | null;
  network: number | string | undefined;
} = {
  primaryWallet: null,
  network: undefined,
};

const mockGetSigner = vi.fn();
const mockPlaceSpotOrder = vi.fn();
const mockFetchEtfMetrics = vi.fn();
const mockFetchNews = vi.fn();
const mockFetchHistoricalInflows = vi.fn();
const mockFetchPriceHistory = vi.fn();
const mockFetchSignalHistory = vi.fn();
const mockFetchBalances = vi.fn();
const mockGetPerpsMaxLeverage = vi.fn();
const mockGetQuantityPrecision = vi.fn();

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    primaryWallet: mockDynamicState.primaryWallet,
    network: mockDynamicState.network,
    handleLogOut: vi.fn(),
    setShowAuthFlow: vi.fn(),
  }),
}));

vi.mock('@dynamic-labs/ethers-v6', () => ({
  getSigner: (...args: unknown[]) => mockGetSigner(...args),
}));

vi.mock('../hooks/useLivePrices', () => ({
  useLivePrices: () => ({ BTC: 95_000, ETH: 3_200, connected: true }),
}));

vi.mock('../services/sosovalue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sosovalue')>();
  return {
    ...actual,
    fetchEtfMetrics: (...args: unknown[]) => mockFetchEtfMetrics(...args),
    fetchNews: (...args: unknown[]) => mockFetchNews(...args),
    fetchHistoricalInflows: (...args: unknown[]) => mockFetchHistoricalInflows(...args),
    fetchPriceHistory: (...args: unknown[]) => mockFetchPriceHistory(...args),
    fetchSignalHistory: (...args: unknown[]) => mockFetchSignalHistory(...args),
  };
});

vi.mock('../services/sodex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sodex')>();
  return {
    ...actual,
    fetchBalances: (...args: unknown[]) => mockFetchBalances(...args),
    getPerpsMaxLeverage: (...args: unknown[]) => mockGetPerpsMaxLeverage(...args),
    getQuantityPrecision: (...args: unknown[]) => mockGetQuantityPrecision(...args),
    placeSpotOrder: (...args: unknown[]) => mockPlaceSpotOrder(...args),
  };
});

import { ConnectionStatusProvider } from '../contexts/ConnectionStatusContext';
import { DashboardProvider } from '../contexts/DashboardContext';
import { useDashboard } from '../contexts/dashboardStore';
import { Header } from '../components/Header';
import { TradeModal } from '../components/TradeModal';
import TradePage from '../pages/app/TradePage';

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ConnectionStatusProvider>
        <DashboardProvider>{children}</DashboardProvider>
      </ConnectionStatusProvider>
    </MemoryRouter>
  );
}

function DashboardEndToEndHarness() {
  const {
    btcData,
    signal,
    signalLoading,
    handleAnalyze,
    history,
    wallet,
    handleConnectWallet,
    handleDisconnectWallet,
    lastUpdated,
    tradeModal,
    closeTradeModal,
    confirmTrade,
    symbol,
    liveBtcPx,
    latestBtcPx,
    signer,
    switchToValueChain,
  } = useDashboard();

  return (
    <div>
      <Header
        wallet={wallet}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        lastUpdated={lastUpdated}
      />
      <div data-testid="etf-loaded">{btcData ? 'ready' : 'loading'}</div>
      <div data-testid="signal-source">{signal?.source ?? 'none'}</div>
      <div data-testid="history-count">{history.length}</div>
      <button type="button" onClick={() => void handleAnalyze()} disabled={signalLoading}>
        Trigger Analyze
      </button>
      <TradePage />
      {tradeModal && (
        <TradeModal
          signal={signal}
          side={tradeModal.side}
          symbol={symbol}
          walletAddress={wallet.address}
          walletChainId={wallet.chainId}
          walletNetworkStatus={wallet.networkStatus}
          onSwitchNetwork={switchToValueChain}
          currentPrice={liveBtcPx ?? latestBtcPx}
          signer={signer}
          onConfirm={confirmTrade}
          onClose={closeTradeModal}
        />
      )}
    </div>
  );
}

describe('Phase 5 end-to-end DashboardContext, fallback isolation & Discord regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAiCircuitBreaker();
    mockFetchEtfMetrics.mockReset().mockResolvedValue({
      totalNetAssets: { value: 1e11, lastUpdateDate: '2026-11-18' },
      totalNetAssetsPercentage: { value: 0.02, lastUpdateDate: '2026-11-18' },
      totalTokenHoldings: { value: 1_000_000, lastUpdateDate: '2026-11-18' },
      dailyNetInflow: { value: 250_000_000, lastUpdateDate: '2026-11-18' },
      cumNetInflow: { value: 3e10, lastUpdateDate: '2026-11-18' },
      dailyTotalValueTraded: { value: 2e9, lastUpdateDate: '2026-11-18' },
      list: [],
    });
    mockFetchNews.mockReset().mockResolvedValue({ list: [], total: '0' });
    mockFetchHistoricalInflows.mockReset().mockResolvedValue([
      { date: '2026-11-16', inflow: 150 },
      { date: '2026-11-17', inflow: 200 },
      { date: '2026-11-18', inflow: 250 },
    ]);
    mockFetchPriceHistory.mockReset().mockResolvedValue([
      { date: '2026-11-16', price: 93_000 },
      { date: '2026-11-17', price: 94_000 },
      { date: '2026-11-18', price: 95_000 },
    ]);
    mockFetchSignalHistory.mockReset().mockResolvedValue([]);
    mockFetchBalances.mockReset().mockResolvedValue({ USDC: '500', BTC: '0.2' });
    mockGetPerpsMaxLeverage.mockReset().mockResolvedValue(40);
    mockGetQuantityPrecision.mockReset().mockResolvedValue(5);
    mockPlaceSpotOrder.mockReset().mockResolvedValue({ success: true, orderId: 'sodex-order-503' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mockDynamicState.primaryWallet = null;
    mockDynamicState.network = undefined;
    mockGetSigner.mockReset();
    localStorage.clear();
    resetAiCircuitBreaker();
  });

  it('never archives, broadcasts to Telegram, or counts fallback signals in stats when /api/analyze returns 503', async () => {
    const fetchCalls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      fetchCalls.push({ url, method });

      if (url === '/api/analyze') {
        return new Response(
          JSON.stringify({ error: 'Model overloaded', errorType: 'upstream_error', retryable: true, fallbackAvailable: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <TestWrapper>
        <DashboardEndToEndHarness />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('etf-loaded').textContent).toBe('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Analyze' }));

    await waitFor(() => {
      expect(screen.getByTestId('signal-source').textContent).toBe('fallback');
    });

    // Give background fire-and-forget promises a tick if any had been scheduled
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchCalls.some(c => c.url === '/api/analyze')).toBe(true);
    expect(fetchCalls.filter(c => c.url.includes('/api/signal-archive'))).toHaveLength(0);
    expect(fetchCalls.filter(c => c.url.includes('/api/telegram-notify'))).toHaveLength(0);
    expect(localStorage.getItem('etfsignal:history')).toBeNull();
    expect(screen.getByTestId('history-count').textContent).toBe('0');

    // Direct signalArchive & stats verification with fallback records
    const oldTs = Date.now() - 36 * 60 * 60 * 1000;
    const fallbackEntries: HistoricalSignal[] = [
      {
        id: 'fb-1', asset: 'BTC', direction: 'BULLISH', confidence: 65,
        headline: 'Rule-based fallback', timestamp: oldTs, entryPrice: 90_000,
        tpPrice: 94_000, slPrice: 87_000, outcome: 'HIT', pnlPct: 4.4, pnlReal: true, source: 'fallback',
      },
      {
        id: 'fb-2', asset: 'ETH', direction: 'BEARISH', confidence: 60,
        headline: 'Rule-based fallback', timestamp: oldTs, entryPrice: 3_000,
        tpPrice: 2_850, slPrice: 3_100, outcome: 'HIT', pnlPct: 5.0, pnlReal: true, source: 'fallback',
      },
      {
        id: 'fb-3', asset: 'BTC', direction: 'BULLISH', confidence: 65,
        headline: 'Rule-based fallback', timestamp: oldTs, entryPrice: 91_000,
        tpPrice: 95_000, slPrice: 88_000, outcome: 'HIT', pnlPct: 4.4, pnlReal: true, source: 'fallback',
      },
    ];

    await saveSignal(fallbackEntries[0]);
    await evaluatePendingSignals();
    expect(localStorage.getItem('etfsignal:history')).toBeNull();
    expect(computeRealStats(fallbackEntries)).toBeNull();
    expect(computeEstimatedStats(fallbackEntries)).toBeNull();
    expect(countResolved(fallbackEntries)).toBe(0);
    expect(buildRealChartData(fallbackEntries)).toEqual([]);
  });

  it('Discord #1: allows Buy/Sell order placement even when /api/analyze returns 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/analyze') {
        return new Response(
          JSON.stringify({ error: 'Upstream 503', errorType: 'upstream_error', retryable: true, fallbackAvailable: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ linked: false }), { status: 200 });
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const vcProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return ACTIVE_VALUECHAIN.chainIdHex;
        return null;
      }),
    };

    const walletOnVc: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn(async () => ACTIVE_VALUECHAIN.chainId),
      switchNetwork: vi.fn().mockResolvedValue(undefined),
      connector: { findProvider: () => vcProvider },
    };
    mockDynamicState.primaryWallet = walletOnVc;
    mockDynamicState.network = ACTIVE_VALUECHAIN.chainId;
    mockGetSigner.mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue(walletOnVc.address),
    });

    render(
      <TestWrapper>
        <DashboardEndToEndHarness />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('etf-loaded').textContent).toBe('ready');
    });

    // Trigger /api/analyze -> 503 -> falls back cleanly
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Analyze' }));
    await waitFor(() => {
      expect(screen.getByTestId('signal-source').textContent).toBe('fallback');
    });

    // Buy & Sell remain enabled and submit cleanly through TradeModal -> SoDEX
    const buyBtn = screen.getByRole('button', { name: /Buy BTC/i });
    expect(buyBtn).not.toBeDisabled();
    fireEvent.click(buyBtn);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /^buy 10 usdc$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPlaceSpotOrder).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Order Placed!')).toBeInTheDocument();
  });

  it('Discord #2: shows Header wrong-network switch pill when wallet starts on Ethereum and switches to ValueChain on click', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ linked: false }), { status: 200 })));

    let currentHexChain = '0x1';
    const ethProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return currentHexChain;
        if (method === 'wallet_switchEthereumChain') {
          currentHexChain = ACTIVE_VALUECHAIN.chainIdHex;
          return null;
        }
        return null;
      }),
    };

    const walletOnEth: DynamicWalletLike = {
      address: '0x2222333344445555666677778888999900001111',
      getNetwork: vi.fn(async () => Number.parseInt(currentHexChain, 16)),
      switchNetwork: vi.fn()
        // Simulate auto-switch declined once so wallet remains on Ethereum Mainnet
        .mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }))
        .mockImplementationOnce(async () => {
          currentHexChain = ACTIVE_VALUECHAIN.chainIdHex;
        }),
      connector: { findProvider: () => ethProvider },
    };

    mockDynamicState.primaryWallet = walletOnEth;
    mockDynamicState.network = 1;
    mockGetSigner.mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue(walletOnEth.address),
    });

    render(
      <TestWrapper>
        <DashboardEndToEndHarness />
      </TestWrapper>,
    );

    const switchPill = await screen.findByRole('button', { name: /Wrong network: Ethereum · Switch/i });
    expect(switchPill).toBeInTheDocument();

    fireEvent.click(switchPill);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Wrong network:/i })).toBeNull();
    });
    expect(screen.getByText(ACTIVE_VALUECHAIN.name)).toBeInTheDocument();
  });
});
