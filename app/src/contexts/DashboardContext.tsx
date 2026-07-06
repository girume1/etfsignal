import {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  type ReactNode,
} from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { getSigner } from '@dynamic-labs/ethers-v6';
import type { JsonRpcSigner } from 'ethers';
import {
  fetchEtfMetrics, fetchNews, fetchHistoricalInflows, fetchPriceHistory,
  fetchSignalHistory,
} from '../services/sosovalue';
import { saveSignal, evaluatePendingSignals } from '../services/signalArchive';
import { getProfile, type UserProfile } from '../services/profile';
import { getSeenAlertIds, markAlertsSeen } from '../services/alertsSeen';
import { deriveAlerts } from '../services/alerts';
import type { HistoricalInflow, PricePoint } from '../types';
import { computeSentiment } from '../services/sentiment';
import { analyzeMarket } from '../services/ai';
import { placeSpotOrder, placePerpsOrder } from '../services/sodex';
import { notifyTelegramSubscribers, notifyTelegramTrade } from '../services/telegram';
import { saveTrade, getTradeHistory } from '../services/tradeHistory';
import { useLivePrices } from '../hooks/useLivePrices';
import { useConnectionStatus } from './ConnectionStatusContext';
import type {
  EtfData, EtfType, NewsItem, MarketSignal, Alert, HistoricalSignal, TradeRecord,
  ActiveTab, WalletState, TradeOrder, OrderSide, SentimentScore,
} from '../types';

interface DashboardContextValue {
  // data
  btcData: EtfData | null;
  ethData: EtfData | null;
  btcHist: HistoricalInflow[];
  ethHist: HistoricalInflow[];
  btcPrice: PricePoint[];
  ethPrice: PricePoint[];
  alerts: Alert[];
  history: HistoricalSignal[];
  news: NewsItem[];
  loading: boolean;
  lastUpdated: Date | null;
  dataError: string | null;
  refresh: () => Promise<void>;

  // active asset
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  activeData: EtfData | null;
  activeHist: HistoricalInflow[];
  activePrice: PricePoint[];
  activeLabel: 'BTC' | 'ETH';
  latestBtcPx: number | undefined;
  latestEthPx: number | undefined;
  liveBtcPx: number | null;
  liveEthPx: number | null;
  liveConnected: boolean;
  sentiment: SentimentScore;

  // signal
  signal: MarketSignal | null;
  signalLoading: boolean;
  signalError: string | null;
  handleAnalyze: () => Promise<void>;

  // wallet + trade
  wallet: WalletState;
  signer: JsonRpcSigner | null;
  handleConnectWallet: () => void;
  handleDisconnectWallet: () => void;
  tradeModal: { side: OrderSide } | null;
  openTradeModal: (side: OrderSide) => void;
  closeTradeModal: () => void;
  confirmTrade: (order: TradeOrder) => Promise<{ orderId: string }>;
  symbol: string;
  tradeHistory: TradeRecord[];
  refreshTradeHistory: () => void;
  profile: UserProfile;
  refreshProfile: () => void;
  unreadAlertCount: number;
  markAlertsAsSeen: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/** Unwrap a PromiseSettledResult — safe in .tsx (no JSX-generic ambiguity). */
function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === 'fulfilled' ? r.value : null;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  // ── ETF data ────────────────────────────────────────────────────────────
  const [btcData,     setBtcData]     = useState<EtfData | null>(null);
  const [ethData,     setEthData]     = useState<EtfData | null>(null);
  const [btcHist,     setBtcHist]     = useState<HistoricalInflow[]>([]);
  const [ethHist,     setEthHist]     = useState<HistoricalInflow[]>([]);
  const [btcPrice,    setBtcPrice]    = useState<PricePoint[]>([]);
  const [ethPrice,    setEthPrice]    = useState<PricePoint[]>([]);
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [history,     setHistory]     = useState<HistoricalSignal[]>([]);
  const [news,        setNews]        = useState<NewsItem[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataError,   setDataError]   = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('btc');

  const [signal,        setSignal]        = useState<MarketSignal | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError,   setSignalError]   = useState<string | null>(null);

  const [wallet,       setWallet]       = useState<WalletState>({ connected: false, address: null, network: null });
  const [signer,       setSigner]       = useState<JsonRpcSigner | null>(null);
  const [tradeModal,   setTradeModal]   = useState<{ side: OrderSide } | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>(() => getTradeHistory());

  // ── Dynamic wallet ───────────────────────────────────────────────────────
  const { primaryWallet, handleLogOut, setShowAuthFlow } = useDynamicContext();

  // Sync wallet state + ethers signer whenever Dynamic's primary wallet changes
  useEffect(() => {
    const address = primaryWallet?.address ?? null;
    setWallet({ connected: !!address, address, network: address ? 'testnet' : null });

    if (primaryWallet) {
      getSigner(primaryWallet)
        .then(s => setSigner(s))
        .catch(() => setSigner(null));
    } else {
      setSigner(null);
    }
  }, [primaryWallet]);

  const handleConnectWallet = useCallback(() => {
    setShowAuthFlow(true);
  }, [setShowAuthFlow]);

  const handleDisconnectWallet = useCallback(() => {
    handleLogOut();
  }, [handleLogOut]);

  // ── Display profile (per-wallet name/avatar, cosmetic only) ────────────────
  const [profile, setProfile] = useState<UserProfile>(() => getProfile(null));
  useEffect(() => { setProfile(getProfile(wallet.address)); }, [wallet.address]);
  const refreshProfile = useCallback(() => setProfile(getProfile(wallet.address)), [wallet.address]);

  // ── Alerts: unread-since-last-visit badge ───────────────────────────────────
  const [seenAlertIds, setSeenAlertIds] = useState<string[]>(() => getSeenAlertIds());
  const unreadAlertCount = useMemo(
    () => alerts.filter(a => !seenAlertIds.includes(a.id)).length,
    [alerts, seenAlertIds],
  );
  const markAlertsAsSeen = useCallback(() => {
    const ids = alerts.map(a => a.id);
    markAlertsSeen(ids);
    setSeenAlertIds(ids);
  }, [alerts]);

  // ── Connection status ────────────────────────────────────────────────────
  const { setSourceStatus } = useConnectionStatus();

  // ── Live prices (Binance WebSocket) ─────────────────────────────────────
  const { BTC: liveBtcPx, ETH: liveEthPx, connected: liveConnected } = useLivePrices();

  // Map Binance WebSocket connection state to ConnectionStatusContext
  useEffect(() => {
    setSourceStatus('binance', liveConnected ? 'live' : 'error');
  }, [liveConnected, setSourceStatus]);

  // ── Data refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      // allSettled so a news/history failure never blocks ETF data + alerts
      const [btcR, ethR, newsR, bInfR, eInfR, bPxR, ePxR, histR] = await Promise.allSettled([
        fetchEtfMetrics('us-btc-spot'),
        fetchEtfMetrics('us-eth-spot'),
        fetchNews({ pageNum: 1, pageSize: 30 }),
        fetchHistoricalInflows('us-btc-spot', 14),
        fetchHistoricalInflows('us-eth-spot', 14),
        fetchPriceHistory('us-btc-spot', 14),
        fetchPriceHistory('us-eth-spot', 14),
        fetchSignalHistory(),
      ]);

      const btc  = settled(btcR);
      const eth  = settled(ethR);
      const bInf = settled(bInfR) ?? [];
      const eInf = settled(eInfR) ?? [];

      if (btc) { setBtcData(btc); }
      if (eth) { setEthData(eth); }
      setBtcHist(bInf); setEthHist(eInf);
      setBtcPrice(settled(bPxR) ?? []); setEthPrice(settled(ePxR) ?? []);
      setHistory(settled(histR) ?? []);

      // Alerts: derive whenever we have at least one ETF dataset
      if (btc || eth) {
        setAlerts(deriveAlerts(
          btc  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          eth  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          bInf,
        ));
      }

      const newsData = settled(newsR);
      if (newsData) setNews(newsData.list);

      setLastUpdated(new Date());

      // Status: live if both ETF feeds succeeded; error only if both failed
      const etfOk = btcR.status === 'fulfilled' || ethR.status === 'fulfilled';
      setSourceStatus('sosovalue', etfOk ? 'live' : 'error');

      if (!etfOk) {
        const firstErr = [btcR, ethR].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setDataError(firstErr?.reason instanceof Error ? firstErr.reason.message : 'Failed to load market data.');
      } else if (btcR.status === 'rejected') {
        setDataError('BTC ETF data temporarily unavailable — showing ETH data only.');
      } else if (ethR.status === 'rejected') {
        setDataError('ETH ETF data temporarily unavailable — showing BTC data only.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load market data.';
      console.error('Failed to load data:', err);
      setDataError(msg);
      setSourceStatus('sosovalue', 'error');
    } finally {
      setLoading(false);
    }
  }, [setSourceStatus]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => { setSignal(null); setSignalError(null); }, [activeTab]);

  // ── Derived values ────────────────────────────────────────────────────────
  const activeData:  EtfData | null     = activeTab === 'btc' ? btcData  : ethData;
  const activeHist:  HistoricalInflow[] = activeTab === 'btc' ? btcHist  : ethHist;
  const activePrice: PricePoint[]       = activeTab === 'btc' ? btcPrice : ethPrice;
  const activeLabel: 'BTC' | 'ETH'     = activeTab === 'btc' ? 'BTC'    : 'ETH';
  const latestBtcPx = btcPrice[btcPrice.length - 1]?.price;
  const latestEthPx = ethPrice[ethPrice.length - 1]?.price;

  const sentiment = useMemo(
    () => computeSentiment(activeHist.map(h => h.inflow)),
    [activeHist],
  );

  // ── Signal persistence ────────────────────────────────────────────────────
  const persistSignal = useCallback((sig: MarketSignal, asset: 'BTC' | 'ETH') => {
    const livePrice = asset === 'BTC'
      ? (liveBtcPx ?? latestBtcPx ?? undefined)
      : (liveEthPx ?? latestEthPx ?? undefined);

    const entry: HistoricalSignal = {
      id:         `sig-${Date.now()}`,
      asset,
      direction:  sig.direction,
      confidence: sig.confidence,
      headline:   sig.headline,
      timestamp:  Date.now(),
      entryPrice: livePrice,
      pnlReal:    false,
      // Only direction-bearing signals with a known entry price are eligible
      // for real backtested evaluation; NEUTRAL signals stay legacy/unevaluated.
      ...(sig.direction !== 'NEUTRAL' && livePrice != null && {
        tpPrice: sig.takeProfit.price,
        slPrice: sig.stopLoss.price,
        outcome: 'PENDING' as const,
      }),
    };

    saveSignal(entry).catch(() => {});
  }, [liveBtcPx, latestBtcPx, liveEthPx, latestEthPx]);

  // ── Signal performance evaluation ────────────────────────────────────────
  // Evaluates PENDING signals ≥24h old against real Binance candles, on mount
  // and every 5 minutes thereafter.
  useEffect(() => {
    const evaluate = () => {
      evaluatePendingSignals()
        .then(fetchSignalHistory)
        .then(setHistory)
        .catch(() => {});
    };
    evaluate();
    const i = setInterval(evaluate, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  // ── AI signal ────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!activeData) return;
    setSignalLoading(true);
    setSignal(null);
    setSignalError(null);
    try {
      const livePrice = activeTab === 'btc' ? (liveBtcPx ?? latestBtcPx) : (liveEthPx ?? latestEthPx);
      const etfType: EtfType = activeTab === 'btc' ? 'us-btc-spot' : 'us-eth-spot';

      // Requirement 2.10: track record from already-loaded real-evaluated signals (>=5 required)
      const resolvedReal = history.filter(s => s.pnlReal === true && typeof s.pnlPct === 'number');
      const backtestSummary = resolvedReal.length >= 5
        ? {
            hitRate: Math.round((resolvedReal.filter(s => s.outcome === 'HIT').length / resolvedReal.length) * 100),
            avgPnl: resolvedReal.reduce((a, s) => a + (s.pnlPct as number), 0) / resolvedReal.length,
            sampleSize: resolvedReal.length,
          }
        : undefined;

      // Requirement 4.7: 30D/90D flow totals for prompt context
      const [flow30, flow90] = await Promise.all([
        fetchHistoricalInflows(etfType, 30),
        fetchHistoricalInflows(etfType, 90),
      ]);
      const flow30dTotal = flow30.length > 0 ? flow30.reduce((a, h) => a + h.inflow, 0) : undefined;
      const flow90dTotal = flow90.length > 0 ? flow90.reduce((a, h) => a + h.inflow, 0) : undefined;

      const r = await analyzeMarket(activeLabel, activeData, news, livePrice, { backtestSummary, flow30dTotal, flow90dTotal });
      setSignal(r);
      persistSignal(r, activeLabel);
      // Fire-and-forget: notify Telegram subscribers (never blocks the UI)
      notifyTelegramSubscribers(r, activeLabel).catch(() => {});
      setHistory(await fetchSignalHistory());
      setSourceStatus('claude', 'live');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claude analysis failed.';
      console.error(err);
      setSignalError(msg);
      setSourceStatus('claude', 'error');
    } finally {
      setSignalLoading(false);
    }
  }, [activeData, activeLabel, activeTab, news, persistSignal, setSourceStatus, history]);

  // ── Trade modal ───────────────────────────────────────────────────────────
  const openTradeModal  = useCallback((side: OrderSide) => setTradeModal({ side }), []);
  const closeTradeModal = useCallback(() => setTradeModal(null), []);

  const refreshTradeHistory = useCallback(() => {
    setTradeHistory(getTradeHistory());
  }, []);

  const confirmTrade = useCallback(async (order: TradeOrder): Promise<{ orderId: string }> => {
    if (!signer) throw new Error('Wallet not connected');
    const r = order.marketType === 'futures'
      ? await placePerpsOrder(signer, {
          symbol: order.symbol,
          side: order.side,
          leverage: order.leverage ?? 20,
          type: order.type,
          price: order.price,
          // funds (USDC) sizing is MARKET-only, same restriction as spot
          ...(order.type === 'LIMIT' || order.currency === order.symbol.split('-')[0]
            ? { quantity: order.quantity }
            : { funds: order.quantity }),
        })
      : await placeSpotOrder(signer, 1, order);
    if (!r.success) throw new Error(r.error);

    // Use the real SoDEX order ID from the response, fall back to local timestamp
    const orderId = r.orderId ?? `etfsignal-${Date.now()}`;
    const record: TradeRecord = {
      id:        orderId,
      orderId,
      pair:      order.symbol,
      side:      order.side,
      type:      order.type,
      size:      order.quantity,
      currency:  order.currency,
      price:     order.price,
      timestamp:     Date.now(),
      status:        'submitted',
      asset:         order.symbol.startsWith('BTC') ? 'BTC' : 'ETH',
      marketType:    order.marketType,
      leverage:      order.leverage,
      signal:        signal?.headline,
      walletAddress: wallet.address ?? undefined,
    };

    saveTrade(record);
    setTradeHistory(getTradeHistory());
    notifyTelegramTrade(record).catch(() => {});

    return { orderId };
  }, [signer, signal]);

  // SoDEX testnet uses USDC as the quote currency (get from https://testnet.sodex.com → Faucet)
  const symbol = activeTab === 'btc' ? 'BTC-USDC' : 'ETH-USDC';

  const value: DashboardContextValue = {
    btcData, ethData, btcHist, ethHist, btcPrice, ethPrice,
    alerts, history, news, loading, lastUpdated, dataError,
    refresh,
    activeTab, setActiveTab, activeData, activeHist, activePrice,
    activeLabel, latestBtcPx, latestEthPx,
    liveBtcPx, liveEthPx, liveConnected,
    sentiment,
    signal, signalLoading, signalError, handleAnalyze,
    wallet, signer,
    handleConnectWallet, handleDisconnectWallet,
    tradeModal, openTradeModal, closeTradeModal, confirmTrade,
    symbol,
    tradeHistory, refreshTradeHistory,
    profile, refreshProfile,
    unreadAlertCount, markAlertsAsSeen,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}
