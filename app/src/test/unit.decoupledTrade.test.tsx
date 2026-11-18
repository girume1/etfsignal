/**
 * Component & integration tests for Phase 2: Decoupling AI from SoDEX trading
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EtfData, MarketSignal } from '../types';

const mockConfirmTrade = vi.fn().mockResolvedValue({ orderId: 'manual-order-001' });
const mockOpenTradeModal = vi.fn();
const mockCloseTradeModal = vi.fn();
const mockHandleAnalyze = vi.fn().mockResolvedValue(undefined);
const mockHandleRetryAi = vi.fn().mockResolvedValue(undefined);

const mockDashboardState: {
  signal: MarketSignal | null;
  signalLoading: boolean;
  tradeModal: { side: 'BUY' | 'SELL' } | null;
} = {
  signal: null,
  signalLoading: false,
  tradeModal: { side: 'BUY' },
};

vi.mock('../contexts/dashboardStore', () => ({
  useDashboard: () => ({
    wallet: { connected: true, address: '0x1111222233334444555566667777888899990000', network: 'mainnet' },
    handleConnectWallet: vi.fn(),
    handleDisconnectWallet: vi.fn(),
    lastUpdated: new Date(),
    dataError: null,
    refresh: vi.fn(),
    signal: mockDashboardState.signal,
    signalLoading: mockDashboardState.signalLoading,
    signalError: null,
    analysisStage: null,
    aiCircuitOpen: false,
    handleAnalyze: mockHandleAnalyze,
    handleRetryAi: mockHandleRetryAi,
    cancelAnalyze: vi.fn(),
    symbol: 'BTC-USDC',
    tradeModal: mockDashboardState.tradeModal,
    openTradeModal: mockOpenTradeModal,
    closeTradeModal: mockCloseTradeModal,
    confirmTrade: mockConfirmTrade,
    signer: null,
    liveBtcPx: 95_000,
    liveEthPx: 3_200,
    latestBtcPx: 95_000,
    latestEthPx: 3_200,
    activeTab: 'btc',
    setActiveTab: vi.fn(),
    tradeHistory: [],
  }),
}));

vi.mock('../components/Header', () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock('../components/AppSidebar', () => ({
  AppSidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../components/OnboardingTour', () => ({
  OnboardingTour: () => null,
}));

vi.mock('../utils/onboardingTour', () => ({
  shouldShowTour: () => false,
}));

vi.mock('../services/sodex', () => ({
  fetchBalances: vi.fn().mockResolvedValue({ USDC: '500', BTC: '0.2' }),
  getPerpsMaxLeverage: vi.fn().mockResolvedValue(40),
  getQuantityPrecision: vi.fn().mockResolvedValue(5),
  updatePerpsCollateral: vi.fn(),
  USE_TESTNET: false,
  CHAIN_ID: 286623,
  CHAIN_ID_HEX: '0x45F9F',
  SPOT_MIN_NOTIONAL_USD: 5,
  PERPS_MIN_NOTIONAL_USD: 10,
  validateOrderMinimum: vi.fn(() => ({ valid: true, minNotionalUsd: 5, minQuantity: 0.00001 })),
  getBuilderConfig: vi.fn(() => ({ id: 456, fee: 50 })),
}));

import { AppShell } from '../components/AppShell';
import { TradeModal } from '../components/TradeModal';
import { SignalPanel } from '../components/SignalPanel';
import { AskAI } from '../components/AskAI';
import TradePage from '../pages/app/TradePage';

const SAMPLE_ETF_DATA: EtfData = {
  totalNetAssets: { value: 100e9, lastUpdateDate: '2026-11-17' },
  totalNetAssetsPercentage: { value: 0.05, lastUpdateDate: '2026-11-17' },
  totalTokenHoldings: { value: 1e6, lastUpdateDate: '2026-11-17' },
  dailyNetInflow: { value: 200e6, lastUpdateDate: '2026-11-17' },
  cumNetInflow: { value: 30e9, lastUpdateDate: '2026-11-17' },
  dailyTotalValueTraded: { value: 2e9, lastUpdateDate: '2026-11-17' },
  list: [],
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockDashboardState.signal = null;
  mockDashboardState.signalLoading = false;
  mockDashboardState.tradeModal = { side: 'BUY' };
});

describe('Phase 2: AI Decoupling, Fallback UI & Manual Order Placement', () => {
  it('AppShell renders TradeModal and submits a manual order when signal is null', async () => {
    mockDashboardState.signal = null;
    mockDashboardState.tradeModal = { side: 'BUY' };

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByText('No AI signal, manual order')).toBeInTheDocument();

    // Checkbox must be ticked before submit becomes enabled
    const submitBtn = screen.getByRole('button', { name: /^buy 10 usdc$/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConfirmTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDC',
          side: 'BUY',
          type: 'MARKET',
          quantity: '10',
          currency: 'USDC',
        }),
      );
    });
    expect(await screen.findByText('Order Placed!')).toBeInTheDocument();
  });

  it('TradeModal with signal=null leaves futures TP/SL un-prefilled and enforces default sizing floor', () => {
    render(
      <TradeModal
        signal={null}
        side="BUY"
        symbol="BTC-USDC"
        currentPrice={95_000}
        onConfirm={mockConfirmTrade}
        onClose={mockCloseTradeModal}
      />,
    );

    expect(screen.getByText('No AI signal, manual order')).toBeInTheDocument();
    // Safe half-Kelly fallback defaults to $10.00 minimum floor with default balance
    expect(screen.getByText('$10.00')).toBeInTheDocument();

    // Switch to Futures and confirm TP / SL inputs are blank (not prefilled)
    fireEvent.click(screen.getByRole('button', { name: /futures/i }));
    const optionalInputs = screen.getAllByPlaceholderText('Optional') as HTMLInputElement[];
    expect(optionalInputs.length).toBeGreaterThanOrEqual(2);
    expect(optionalInputs[0].value).toBe('');
    expect(optionalInputs[1].value).toBe('');
  });

  it('TradePage marks signal as Optional and keeps Buy/Sell enabled even while signalLoading is true', () => {
    mockDashboardState.signal = null;
    mockDashboardState.signalLoading = true;
    mockDashboardState.tradeModal = null;

    const { rerender } = render(<TradePage />);

    const buyBtn = screen.getByRole('button', { name: /buy btc/i });
    const sellBtn = screen.getByRole('button', { name: /sell btc/i });
    expect(buyBtn).not.toBeDisabled();
    expect(sellBtn).not.toBeDisabled();

    fireEvent.click(buyBtn);
    expect(mockOpenTradeModal).toHaveBeenCalledWith('BUY');

    // When not loading and signal is null, the card explicitly says Optional
    mockDashboardState.signalLoading = false;
    rerender(<TradePage />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('SignalPanel renders visible Rule-based fallback badge and Try AI again button when circuit is open', () => {
    const onRetryAi = vi.fn();
    const fallbackSignal: MarketSignal = {
      direction: 'BULLISH',
      confidence: 58,
      headline: 'Rule-based: BTC ETF inflows (+$200.0M) support upward bias',
      summary: 'Deterministic summary.',
      keyFactors: ['Daily flow positive', 'Sentiment bullish', 'IBIT leading'],
      tradeIdea: 'Constructive long bias.',
      riskWarning: 'Rule-based fallback.',
      entryZone: { low: 94400, high: 95600 },
      takeProfit: { price: 99275, pct: 4.5, rationale: 'Fixed target' },
      stopLoss: { price: 92625, pct: -2.5, rationale: 'Fixed stop' },
      weights: [
        { factor: 'ETF Daily Inflow', weight: 35, signal: 'positive' },
        { factor: '14D Flow Momentum', weight: 30, signal: 'positive' },
        { factor: 'Cumulative Flow Trend', weight: 20, signal: 'positive' },
        { factor: 'Fund Breadth', weight: 15, signal: 'neutral' },
      ],
      timestamp: new Date(),
      source: 'fallback',
      degradedReason: 'AI provider overloaded (HTTP 503) — showing rule-based fallback.',
    };

    render(
      <SignalPanel
        signal={fallbackSignal}
        loading={false}
        onAnalyze={mockHandleAnalyze}
        activeTab="btc"
        onTrade={mockOpenTradeModal}
        walletConnected={true}
        circuitOpen={true}
        onRetryAi={onRetryAi}
      />,
    );

    expect(screen.getByText('Rule-based fallback (AI unavailable)')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
    expect(screen.getByText(/HTTP 503/i)).toBeInTheDocument();

    const tryBtn = screen.getByRole('button', { name: /try ai again/i });
    fireEvent.click(tryBtn);
    expect(onRetryAi).toHaveBeenCalledOnce();
  });

  it('AskAI degrades gracefully without crashing when /api/analyze fails and shows Try again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'The Agent is overloaded' }),
    }));

    render(<AskAI asset="BTC" etfData={SAMPLE_ETF_DATA} signal={null} />);

    fireEvent.click(screen.getByText('Why is IBIT leading inflows?'));

    expect(await screen.findByText(/The Agent is overloaded/i)).toBeInTheDocument();
    expect(screen.getByText(/manual trading/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
