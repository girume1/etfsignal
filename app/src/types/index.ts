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

export interface TpSlLevel {
  price: number;
  pct: number;
  rationale: string;
}

export interface EntryZone {
  low: number;
  high: number;
}

/** One row in the AI-generated signal breakdown (weights sum to ~100). */
export interface SignalWeight {
  factor: string;
  weight: number;          // 0–100
  signal: 'positive' | 'negative' | 'neutral';
}

export interface MarketSignal {
  direction: SignalDirection;
  confidence: number; // 0-100
  headline: string;
  summary: string;
  keyFactors: string[];
  tradeIdea: string;
  riskWarning: string;
  entryZone: EntryZone;
  takeProfit: TpSlLevel;
  stopLoss: TpSlLevel;
  timestamp: Date;
  /** Factor-level weighting breakdown produced by the AI model. */
  weights?: SignalWeight[];
}

// ─── SoDEX Types ───────────────────────────────────────────────────────────

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';

export interface TradeOrder {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;       // amount entered by user
  currency: string;       // BTC or USDC — determines quantity vs funds field
  price?: string;         // for LIMIT orders
}

export interface TradeConfirmation {
  order: TradeOrder;
  signal: MarketSignal;
  acknowledged: boolean;
}

export interface TradeRecord {
  id:        string;      // etfsignal-{timestamp}
  orderId:   string;      // same as id (or exchange-assigned if available)
  pair:      string;      // BTC-USDC
  side:      OrderSide;   // BUY | SELL
  type:      OrderType;   // MARKET | LIMIT
  size:      string;      // "0.01"
  currency:  string;      // BTC | USDC
  price?:    string;      // limit price (LIMIT orders only)
  timestamp: number;      // ms epoch
  status:    'submitted' | 'filled' | 'failed';
  asset:          'BTC' | 'ETH';
  signal?:        string;   // signal headline for context
  walletAddress?: string;   // linked wallet — used for personal Telegram alert
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
  entryPrice?: number; // live price at signal generation time
  pnlPct?: number;     // real evaluated outcome (after 24h) or mock
  pnlReal?: boolean;   // true = evaluated from real price, false/absent = mock
}

export interface SentimentScore {
  score: number;          // 0-100, 50 = neutral
  label: string;          // e.g. "Cautiously bullish"
  momentum: number;       // -1 to 1
  inflowTrend: number[];  // recent daily inflows
}

// ─── Historical Data ───────────────────────────────────────────────────────

export interface HistoricalInflow {
  date: string;   // YYYY-MM-DD
  inflow: number; // USD
}

export interface PricePoint {
  date: string;
  price: number;
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
