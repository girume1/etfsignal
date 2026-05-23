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
import { deriveAlerts } from '../services/alerts';
import type { HistoricalInflow, PricePoint } from '../types';
import { computeSentiment } from '../services/sentiment';
import { analyzeMarket } from '../services/ai';
import { placeSpotOrder } from '../services/sodex';
import { notifyTelegramSubscribers } from '../services/telegram';
import { useLivePrices } from '../hooks/useLivePrices';
import { useConnectionStatus } from './ConnectionStatusContext';
import type {
  EtfData, NewsItem, MarketSignal, Alert, HistoricalSignal,
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
  confirmTrade: (order: TradeOrder) => Promise<void>;
  symbol: string;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

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

  const [wallet,     setWallet]     = useState<WalletState>({ connected: false, address: null, network: null });
  const [signer,     setSigner]     = useState<JsonRpcSigner | null>(null);
  const [tradeModal, setTradeModal] = useState<{ side: OrderSide } | null>(null);

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

      // <T,> trailing comma prevents TSX parser from treating <T> as JSX
      const ok = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' ? r.value : null;

      const btc  = ok(btcR);
      const eth  = ok(ethR);
      const bInf = ok(bInfR) ?? [];
      const eInf = ok(eInfR) ?? [];

      if (btc) { setBtcData(btc); }
      if (eth) { setEthData(eth); }
      setBtcHist(bInf); setEthHist(eInf);
      setBtcPrice(ok(bPxR) ?? []); setEthPrice(ok(ePxR) ?? []);
      setHistory(ok(histR) ?? []);

      // Alerts: derive whenever we have at least one ETF dataset
      if (btc || eth) {
        setAlerts(deriveAlerts(
          btc  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          eth  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          bInf,
        ));
      }

      const newsData = ok(newsR);
      if (newsData) setNews(newsData.list);

      setLastUpdated(new Date());

      // Status: live if both ETF feeds succeeded; error only if both failed
      const etfOk = btcR.status === 'fulfilled' || ethR.status === 'fulfilled';
      setSourceStatus('sosovalue', etfOk ? 'live' : 'error');

      if (!etfOk) {
        const firstErr = [btcR, ethR].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setDataError(firstErr?.reason instanceof Error ? firstErr.reason.message : 'Failed to load market data.');
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
    const entry: HistoricalSignal = {
      id: `sig-${Date.now()}`,
      asset,
      direction: sig.direction,
      confidence: sig.confidence,
      headline: sig.headline,
      timestamp: Date.now(),
    };
    const existing: HistoricalSignal[] = JSON.parse(
      localStorage.getItem('etfsignal:history') ?? '[]'
    );
    localStorage.setItem(
      'etfsignal:history',
      JSON.stringify([entry, ...existing].slice(0, 20))
    );
  }, []);

  // ── AI signal ────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!activeData) return;
    setSignalLoading(true);
    setSignal(null);
    setSignalError(null);
    try {
      const livePrice = activeTab === 'btc' ? (liveBtcPx ?? latestBtcPx) : (liveEthPx ?? latestEthPx);
      const r = await analyzeMarket(activeLabel, activeData, news, livePrice);
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
  }, [activeData, activeLabel, news, persistSignal, setSourceStatus]);

  // ── Trade modal ───────────────────────────────────────────────────────────
  const openTradeModal  = useCallback((side: OrderSide) => setTradeModal({ side }), []);
  const closeTradeModal = useCallback(() => setTradeModal(null), []);

  const confirmTrade = useCallback(async (order: TradeOrder) => {
    if (!signer) throw new Error('Wallet not connected');
    const r = await placeSpotOrder(signer, 1, order);
    if (!r.success) throw new Error(r.error);
  }, [signer]);

  const symbol = activeTab === 'btc' ? 'BTC-USDT' : 'ETH-USDT';

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
