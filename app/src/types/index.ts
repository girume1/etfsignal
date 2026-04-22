// ─── SoSoValue API Types ───────────────────────────────────────────────────

export interface EtfMetric {
  value: number | null;
  lastUpdateDate: string;
  status?: string;
}

export interface EtfFund {
  id: string;
  ticker: string;
  institute: string;
  netAssets: EtfMetric;
  netAssetsPercentage: EtfMetric;
  dailyNetInflow: EtfMetric;
  cumNetInflow: EtfMetric;
  dailyValueTraded: EtfMetric;
  fee: EtfMetric;
  discountPremiumRate: EtfMetric;
}

export interface EtfData {
  totalNetAssets: EtfMetric;
  totalNetAssetsPercentage: EtfMetric;
  totalTokenHoldings: EtfMetric;
  dailyNetInflow: EtfMetric;
  cumNetInflow: EtfMetric;
  dailyTotalValueTraded: EtfMetric;
  list: EtfFund[];
}

export type EtfType = 'us-btc-spot' | 'us-eth-spot';

export interface NewsItem {
  id: string;
  sourceLink: string;
  releaseTime: number;
  author: string;
  category: number;
  featureImage: string;
  matchedCurrencies: { id: string; fullName: string; name: string }[];
  tags: string[];
  multilanguageContent: { language: string; title: string; content: string }[];
}

// ─── AI Signal Types ───────────────────────────────────────────────────────

export type SignalDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface MarketSignal {
  direction: SignalDirection;
  confidence: number; // 0-100
  headline: string;
  summary: string;
  keyFactors: string[];
  tradeIdea: string;
  riskWarning: string;
  timestamp: Date;
}

// ─── SoDEX Types ───────────────────────────────────────────────────────────

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';

export interface TradeOrder {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string; // for LIMIT orders
}

export interface TradeConfirmation {
  order: TradeOrder;
  signal: MarketSignal;
  acknowledged: boolean;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  network: 'testnet' | 'mainnet' | null;
}

// ─── Alerts / Signal History / Sentiment ──────────────────────────────────

export type AlertKind = 'inflow' | 'outflow' | 'rotation' | 'milestone' | 'anomaly';
export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  ticker?: string;
  asset: 'BTC' | 'ETH' | 'MKT';
  timestamp: number; // ms epoch
  severity: 'low' | 'med' | 'high';
}

export interface HistoricalSignal {
  id: string;
  asset: 'BTC' | 'ETH';
  direction: SignalDirection;
  confidence: number;
  headline: string;
  timestamp: number;
  pnlPct?: number; // optional mock back-test
}

export interface SentimentScore {
  score: number;          // 0-100, 50 = neutral
  label: string;          // e.g. "Cautiously bullish"
  momentum: number;       // -1 to 1
  inflowTrend: number[];  // recent daily inflows
}

// ─── App State ─────────────────────────────────────────────────────────────

export type ActiveTab = 'btc' | 'eth';
export type NewsCategory = 'all' | 'news' | 'research' | 'onchain' | 'alerts';

export const NEWS_CATEGORY_MAP: Record<number, string> = {
  1: 'News',
  2: 'Research',
  3: 'Institution',
  4: 'Insights',
  5: 'Macro News',
  6: 'Macro Research',
  7: 'Tweet',
  9: 'Price Alert',
  10: 'On-Chain',
};
