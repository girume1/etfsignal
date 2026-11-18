import { createContext, useContext } from 'react';
import type { JsonRpcSigner } from 'ethers';
import type { HistoricalInflow, PricePoint } from '../types';
import type { AnalysisStage } from '../services/ai';
import type { UserProfile } from '../services/profile';
import type {
  EtfData, NewsItem, MarketSignal, Alert, HistoricalSignal, TradeRecord,
  ActiveTab, WalletState, TradeOrder, OrderSide, SentimentScore,
} from '../types';

export interface DashboardContextValue {
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
  analysisStage: AnalysisStage | null;
  aiCircuitOpen: boolean;
  handleAnalyze: () => Promise<void>;
  handleRetryAi: () => Promise<void>;
  cancelAnalyze: () => void;

  // wallet + trade
  wallet: WalletState;
  signer: JsonRpcSigner | null;
  handleConnectWallet: () => void;
  handleDisconnectWallet: () => void;
  switchToValueChain: () => Promise<boolean>;
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

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}
