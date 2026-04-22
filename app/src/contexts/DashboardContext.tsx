import {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  type ReactNode,
} from 'react';
import {
  fetchEtfMetrics, fetchNews, fetchHistoricalInflows, fetchPriceHistory,
  fetchAlerts, fetchSignalHistory, isMockMode, mockReason,
} from '../services/sosovalue';
import type { HistoricalInflow, PricePoint } from '../services/sosovalue';
import { computeSentiment } from '../services/mockData';
import { analyzeMarket } from '../services/ai';
import { connectWallet, placeSpotOrder } from '../services/sodex';
import type {
  EtfData, NewsItem, MarketSignal, Alert, HistoricalSignal,
  ActiveTab, WalletState, TradeOrder, OrderSide, SentimentScore,
} from '../types';
import { ethers } from 'ethers';

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
  effectiveMock: boolean;
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
  sentiment: SentimentScore;

  // signal
  signal: MarketSignal | null;
  signalLoading: boolean;
  signalError: string | null;
  handleAnalyze: () => Promise<void>;

  // wallet + trade
  wallet: WalletState;
  signer: ethers.Signer | null;
  handleConnectWallet: () => Promise<void>;
  handleDisconnectWallet: () => void;
  tradeModal: { side: OrderSide } | null;
  openTradeModal: (side: OrderSide) => void;
  closeTradeModal: () => void;
  confirmTrade: (order: TradeOrder) => Promise<void>;
  symbol: string;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  // data
  const [btcData,   setBtcData]    = useState<EtfData | null>(null);
  const [ethData,   setEthData]    = useState<EtfData | null>(null);
  const [btcHist,   setBtcHist]    = useState<HistoricalInflow[]>([]);
  const [ethHist,   setEthHist]    = useState<HistoricalInflow[]>([]);
  const [btcPrice,  setBtcPrice]   = useState<PricePoint[]>([]);
  const [ethPrice,  setEthPrice]   = useState<PricePoint[]>([]);
  const [alerts,    setAlerts]     = useState<Alert[]>([]);
  const [history,   setHistory]    = useState<HistoricalSignal[]>([]);
  const [news,      setNews]       = useState<NewsItem[]>([]);
  const [loading,   setLoading]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataError, setDataError]  = useState<string | null>(null);
  const [effectiveMock, setEffectiveMock] = useState<boolean>(isMockMode);

  const [activeTab, setActiveTab] = useState<ActiveTab>('btc');

  const [signal,        setSignal]        = useState<MarketSignal | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError,   setSignalError]   = useState<string | null>(null);

  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: null, network: null });
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [tradeModal, setTradeModal] = useState<{ side: OrderSide } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      const [btc, eth, newsData, bInf, eInf, bPx, ePx, al, hist] = await Promise.all([
        fetchEtfMetrics('us-btc-spot'),
        fetchEtfMetrics('us-eth-spot'),
        fetchNews({ pageNum: 1, pageSize: 30 }),
        fetchHistoricalInflows('us-btc-spot', 14),
        fetchHistoricalInflows('us-eth-spot', 14),
        fetchPriceHistory('us-btc-spot', 14),
        fetchPriceHistory('us-eth-spot', 14),
        fetchAlerts(),
        fetchSignalHistory(),
      ]);
      setBtcData(btc); setEthData(eth);
      setBtcHist(bInf); setEthHist(eInf);
      setBtcPrice(bPx); setEthPrice(ePx);
      setAlerts(al); setHistory(hist);
      setNews(newsData.list);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setDataError(err?.message || 'Failed to load market data. Check API key or network.');
    } finally {
      setEffectiveMock(mockReason() !== null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => { setSignal(null); setSignalError(null); }, [activeTab]);

  const activeData   = activeTab === 'btc' ? btcData   : ethData;
  const activeHist   = activeTab === 'btc' ? btcHist   : ethHist;
  const activePrice  = activeTab === 'btc' ? btcPrice  : ethPrice;
  const activeLabel: 'BTC' | 'ETH' = activeTab === 'btc' ? 'BTC' : 'ETH';
  const latestBtcPx  = btcPrice[btcPrice.length - 1]?.price;
  const latestEthPx  = ethPrice[ethPrice.length - 1]?.price;

  const sentiment = useMemo(
    () => computeSentiment(activeHist.map(h => h.inflow)),
    [activeHist],
  );

  const handleAnalyze = useCallback(async () => {
    if (!activeData) return;
    setSignalLoading(true);
    setSignal(null);
    setSignalError(null);
    try {
      const r = await analyzeMarket(activeLabel, activeData, news);
      setSignal(r);
    } catch (err: any) {
      console.error(err);
      setSignalError(err?.message || 'Claude analysis failed. Check ANTHROPIC_API_KEY on the server and retry.');
    } finally {
      setSignalLoading(false);
    }
  }, [activeData, activeLabel, news]);

  const handleConnectWallet = useCallback(async () => {
    if (wallet.connected) return;
    const r = await connectWallet();
    if (r) {
      setSigner(r.signer);
      setWallet({ connected: true, address: r.address, network: 'testnet' });
    }
  }, [wallet.connected]);

  const handleDisconnectWallet = useCallback(() => {
    setSigner(null);
    setWallet({ connected: false, address: null, network: null });
  }, []);

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
    effectiveMock, refresh,
    activeTab, setActiveTab, activeData, activeHist, activePrice,
    activeLabel, latestBtcPx, latestEthPx, sentiment,
    signal, signalLoading, signalError, handleAnalyze,
    wallet, signer, handleConnectWallet, handleDisconnectWallet,
    tradeModal, openTradeModal, closeTradeModal, confirmTrade,
    symbol,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}
