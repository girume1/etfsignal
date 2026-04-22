// ─── Mock data fallback ──────────────────────────────────────────────────
// Used only when VITE_SOSOVALUE_API_KEY is missing (API access still pending).
// Keeps the demo fully interactive for Buildathon judges: ETF panels, news,
// AI signal synthesis, and the trade modal all continue to work end-to-end.
//
// Numbers are shaped from real BTC/ETH spot ETF ranges seen in early 2026,
// but marked clearly in the UI as "Demo data" whenever this path fires.

import type { EtfData, NewsItem, EtfType, Alert, HistoricalSignal, SentimentScore } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

// ─── BTC spot ETF snapshot ────────────────────────────────────────────────
const BTC_FUNDS = [
  { ticker: 'IBIT',  institute: 'BlackRock iShares',       dailyNetInflow:  281_400_000, netAssets: 58_900_000_000, fee: 0.0025 },
  { ticker: 'FBTC',  institute: 'Fidelity Wise Origin',    dailyNetInflow:   92_300_000, netAssets: 21_400_000_000, fee: 0.0025 },
  { ticker: 'ARKB',  institute: 'ARK 21Shares',            dailyNetInflow:   34_100_000, netAssets:  5_200_000_000, fee: 0.0021 },
  { ticker: 'BITB',  institute: 'Bitwise',                 dailyNetInflow:   28_700_000, netAssets:  4_600_000_000, fee: 0.0020 },
  { ticker: 'HODL',  institute: 'VanEck',                  dailyNetInflow:    6_200_000, netAssets:  1_300_000_000, fee: 0.0020 },
  { ticker: 'BRRR',  institute: 'Valkyrie',                dailyNetInflow:    3_400_000, netAssets:    680_000_000, fee: 0.0025 },
  { ticker: 'BTCO',  institute: 'Invesco Galaxy',          dailyNetInflow:    1_900_000, netAssets:    780_000_000, fee: 0.0025 },
  { ticker: 'EZBC',  institute: 'Franklin',                dailyNetInflow:    1_100_000, netAssets:    520_000_000, fee: 0.0019 },
  { ticker: 'BTC',   institute: 'Grayscale Mini Bitcoin',  dailyNetInflow:   12_400_000, netAssets:  4_100_000_000, fee: 0.0015 },
  { ticker: 'GBTC',  institute: 'Grayscale Bitcoin Trust', dailyNetInflow:  -49_500_000, netAssets: 18_200_000_000, fee: 0.0150 },
];

// ─── ETH spot ETF snapshot ────────────────────────────────────────────────
const ETH_FUNDS = [
  { ticker: 'ETHA',  institute: 'BlackRock iShares',       dailyNetInflow:   23_100_000, netAssets:  4_200_000_000, fee: 0.0025 },
  { ticker: 'FETH',  institute: 'Fidelity Ethereum',       dailyNetInflow:   14_500_000, netAssets:  1_900_000_000, fee: 0.0025 },
  { ticker: 'ETHW',  institute: 'Bitwise',                 dailyNetInflow:    4_200_000, netAssets:    420_000_000, fee: 0.0020 },
  { ticker: 'CETH',  institute: '21Shares Core Ethereum',  dailyNetInflow:    2_800_000, netAssets:    310_000_000, fee: 0.0021 },
  { ticker: 'ETHV',  institute: 'VanEck',                  dailyNetInflow:    1_900_000, netAssets:    265_000_000, fee: 0.0020 },
  { ticker: 'QETH',  institute: 'Invesco Galaxy',          dailyNetInflow:      900_000, netAssets:    190_000_000, fee: 0.0025 },
  { ticker: 'EZET',  institute: 'Franklin Ethereum',       dailyNetInflow:      450_000, netAssets:     95_000_000, fee: 0.0019 },
  { ticker: 'ETH',   institute: 'Grayscale Mini Ethereum', dailyNetInflow:    3_400_000, netAssets:    920_000_000, fee: 0.0015 },
  { ticker: 'ETHE',  institute: 'Grayscale Ethereum Trust',dailyNetInflow:  -78_300_000, netAssets:  5_800_000_000, fee: 0.0250 },
];

function buildEtfSnapshot(type: EtfType): EtfData {
  const raw = type === 'us-btc-spot' ? BTC_FUNDS : ETH_FUNDS;
  const priceAssumption = type === 'us-btc-spot' ? 98_000 : 3_450;
  const date = today();

  const list = raw.map((f, i) => {
    const netAssets = f.netAssets;
    const cumNetInflow = Math.round(netAssets * 0.45 + f.dailyNetInflow * 30);
    const dailyValueTraded = Math.round(netAssets * 0.012);
    const discountPremium = (Math.sin(i * 1.7) * 0.0015); // ~±15bps
    return {
      id: `${type}-${f.ticker}`,
      ticker: f.ticker,
      institute: f.institute,
      netAssets:           { value: netAssets,          lastUpdateDate: date },
      netAssetsPercentage: { value: 0,                  lastUpdateDate: date }, // filled below
      dailyNetInflow:      { value: f.dailyNetInflow,   lastUpdateDate: date },
      cumNetInflow:        { value: cumNetInflow,       lastUpdateDate: date },
      dailyValueTraded:    { value: dailyValueTraded,   lastUpdateDate: date },
      fee:                 { value: f.fee,              lastUpdateDate: date },
      discountPremiumRate: { value: discountPremium,    lastUpdateDate: date },
    };
  });

  const totalNetAssets = list.reduce((s, f) => s + (f.netAssets.value || 0), 0);
  list.forEach(f => { f.netAssetsPercentage.value = f.netAssets.value! / totalNetAssets; });

  const dailyNetInflow  = list.reduce((s, f) => s + (f.dailyNetInflow.value  || 0), 0);
  const cumNetInflow    = list.reduce((s, f) => s + (f.cumNetInflow.value    || 0), 0);
  const dailyValueTraded= list.reduce((s, f) => s + (f.dailyValueTraded.value|| 0), 0);
  const totalTokenHoldings = Math.round(totalNetAssets / priceAssumption);

  return {
    totalNetAssets:           { value: totalNetAssets,          lastUpdateDate: date },
    totalNetAssetsPercentage: { value: 0.0032,                  lastUpdateDate: date }, // ~ day-over-day %
    totalTokenHoldings:       { value: totalTokenHoldings,      lastUpdateDate: date },
    dailyNetInflow:           { value: dailyNetInflow,          lastUpdateDate: date },
    cumNetInflow:             { value: cumNetInflow,            lastUpdateDate: date },
    dailyTotalValueTraded:    { value: dailyValueTraded,        lastUpdateDate: date },
    list,
  };
}

export const MOCK_BTC_ETF: EtfData = buildEtfSnapshot('us-btc-spot');
export const MOCK_ETH_ETF: EtfData = buildEtfSnapshot('us-eth-spot');

export function getMockEtfData(type: EtfType): EtfData {
  return type === 'us-btc-spot' ? MOCK_BTC_ETF : MOCK_ETH_ETF;
}

// ─── Historical daily inflows (14 days) ──────────────────────────────────
// Realistic-looking series so the sparkline has visible momentum.
const BTC_HISTORY_M = [ -62, -34, 18, 91, 204, 178, -12, 45, 132, 288, 410, 265, 332, 412 ];
const ETH_HISTORY_M = [ -18, -42, -88, -12, 22, 65, 44, -8, -28, 18, 41, 62, 30, -28 ];

export interface HistoricalInflow {
  date: string;       // YYYY-MM-DD
  inflow: number;     // USD
}

export function getMockHistory(type: EtfType, days = 14): HistoricalInflow[] {
  const base = type === 'us-btc-spot' ? BTC_HISTORY_M : ETH_HISTORY_M;
  const series = base.slice(-days);
  const now = Date.now();
  return series.map((m, i) => ({
    date: new Date(now - (series.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    inflow: m * 1_000_000,
  }));
}

// ─── Mock news feed ───────────────────────────────────────────────────────
const NOW = Date.now();
const min = (m: number) => NOW - m * 60_000;

const MOCK_HEADLINES: Array<{
  category: number; title: string; tags: string[]; minsAgo: number;
  author?: string; currencies?: { id: string; name: string; fullName: string }[];
}> = [
  { category: 10, minsAgo:  8, title: 'BlackRock IBIT records its 14th consecutive day of net inflows, crossing $58B in AUM',
    tags: ['IBIT', 'BlackRock', 'ETF'], currencies: [{ id: 'btc', name: 'BTC', fullName: 'Bitcoin' }] },
  { category: 1,  minsAgo: 18, title: 'Grayscale GBTC sees modest outflow as investors rotate into lower-fee BTC ETFs',
    tags: ['GBTC', 'Grayscale'] },
  { category: 3,  minsAgo: 27, title: 'Fidelity files for ETH staking inclusion in FETH — SEC response expected within 45 days',
    tags: ['FETH', 'Fidelity', 'Staking'], currencies: [{ id: 'eth', name: 'ETH', fullName: 'Ethereum' }] },
  { category: 9,  minsAgo: 41, title: 'BTC breaks above $98K on strong institutional inflow confirmation',
    tags: ['BTC', 'Price'] },
  { category: 2,  minsAgo: 62, title: 'Research: BTC spot ETF daily flows lead spot price by ~18 hours, per cross-correlation analysis',
    tags: ['Research', 'ETF'] },
  { category: 7,  minsAgo: 74, title: '@michaelsaylor: "Institutional bitcoin adoption curve is steepening, not flattening."',
    tags: ['Saylor', 'Bitcoin'], author: '@michaelsaylor' },
  { category: 5,  minsAgo: 95, title: 'Fed minutes show rate-cut timing uncertainty — risk assets see volatile reaction',
    tags: ['Fed', 'Macro'] },
  { category: 10, minsAgo: 112, title: 'On-chain: 12.4K BTC moved from Coinbase custody wallets linked to multiple ETF issuers',
    tags: ['On-Chain', 'Coinbase'] },
  { category: 4,  minsAgo: 140, title: 'ETH ETFs see mixed flows as staking yields remain the key market question',
    tags: ['ETH', 'ETF'], currencies: [{ id: 'eth', name: 'ETH', fullName: 'Ethereum' }] },
  { category: 6,  minsAgo: 168, title: 'Macro thesis: bitcoin correlation to Nasdaq drops to 0.31 — lowest in 14 months',
    tags: ['Correlation', 'Macro'] },
  { category: 1,  minsAgo: 205, title: 'Bitwise BITB crosses $4.6B AUM milestone after consistent fresh capital inflows',
    tags: ['BITB', 'Bitwise'] },
  { category: 2,  minsAgo: 240, title: 'Signals research: ETF outflows > 2σ historically mean-revert within 3 trading days',
    tags: ['Research', 'Signals'] },
];

// ─── Price history (for chart overlay) ────────────────────────────────────
export interface PricePoint { date: string; price: number }

const BTC_PRICE_SERIES = [
  92_400, 93_100, 94_250, 93_800, 95_600, 96_100, 94_900, 95_400, 96_800, 97_200, 98_400, 97_900, 98_100, 98_450,
];
const ETH_PRICE_SERIES = [
  3_280, 3_310, 3_395, 3_420, 3_388, 3_440, 3_505, 3_460, 3_395, 3_420, 3_480, 3_510, 3_470, 3_455,
];

export function getMockPriceHistory(type: EtfType, days = 14): PricePoint[] {
  const series = (type === 'us-btc-spot' ? BTC_PRICE_SERIES : ETH_PRICE_SERIES).slice(-days);
  const now = Date.now();
  return series.map((price, i) => ({
    date: new Date(now - (series.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    price,
  }));
}

// ─── Sentiment score from inflow series ───────────────────────────────────
// Simple but defensible: blend short-term momentum (last 3d vs prev 11d)
// with positive-day ratio. Output clamped to 0–100, 50 = neutral.
export function computeSentiment(inflows: number[]): SentimentScore {
  if (inflows.length < 4) {
    return { score: 50, label: 'Insufficient data', momentum: 0, inflowTrend: inflows };
  }
  const recent = inflows.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const prior  = inflows.slice(0, -3).reduce((a, b) => a + b, 0) / (inflows.length - 3);
  const scale  = Math.max(Math.abs(recent), Math.abs(prior), 1);
  const momentum = Math.max(-1, Math.min(1, (recent - prior) / (scale * 2)));
  const posRatio = inflows.filter(v => v > 0).length / inflows.length;

  const score = Math.round(50 + momentum * 30 + (posRatio - 0.5) * 40);
  const clamped = Math.max(0, Math.min(100, score));

  let label: string;
  if (clamped >= 75)      label = 'Strongly bullish';
  else if (clamped >= 60) label = 'Cautiously bullish';
  else if (clamped >= 45) label = 'Neutral';
  else if (clamped >= 30) label = 'Cautiously bearish';
  else                    label = 'Strongly bearish';

  return { score: clamped, label, momentum, inflowTrend: inflows };
}

// ─── Smart alerts (mock) ──────────────────────────────────────────────────
export function getMockAlerts(): Alert[] {
  const m = (n: number) => NOW - n * 60_000;
  return [
    { id: 'a1', kind: 'inflow',     asset: 'BTC', ticker: 'IBIT',
      title: 'IBIT posts largest single-day inflow this week',
      body: '+$281.4M into BlackRock iShares — 14th consecutive positive day.',
      timestamp: m(12), severity: 'high' },
    { id: 'a2', kind: 'outflow',    asset: 'BTC', ticker: 'GBTC',
      title: 'GBTC outflows accelerate — 3rd day running',
      body: '-$49.5M today. Fee differential (1.50% vs 0.25%) driving rotation.',
      timestamp: m(38), severity: 'med' },
    { id: 'a3', kind: 'rotation',   asset: 'ETH',
      title: 'ETH ETFs net negative while BTC hits fresh highs',
      body: 'Cross-asset rotation signal: ETH -$28M, BTC +$412M.',
      timestamp: m(67), severity: 'med' },
    { id: 'a4', kind: 'milestone',  asset: 'ETH', ticker: 'ETHA',
      title: 'BlackRock ETHA crosses $4.2B in net assets',
      body: 'Now the clear leader in ETH ETF market share (~42%).',
      timestamp: m(124), severity: 'low' },
    { id: 'a5', kind: 'anomaly',    asset: 'MKT',
      title: 'Aggregate BTC ETF flow > 2σ above 30-day mean',
      body: 'Statistically significant inflow event. Historically mean-reverts within 3–5 days.',
      timestamp: m(201), severity: 'high' },
  ];
}

// ─── Signal history (for demo panel) ──────────────────────────────────────
export function getMockSignalHistory(): HistoricalSignal[] {
  const day = 86_400_000;
  return [
    { id: 's1', asset: 'BTC', direction: 'BULLISH', confidence: 82,
      headline: 'Sustained institutional accumulation; BTC momentum intact',
      timestamp: NOW - 1 * day, pnlPct: 2.4 },
    { id: 's2', asset: 'ETH', direction: 'NEUTRAL', confidence: 54,
      headline: 'ETH flows mixed; staking approval timing uncertain',
      timestamp: NOW - 2 * day, pnlPct: -0.3 },
    { id: 's3', asset: 'BTC', direction: 'BULLISH', confidence: 78,
      headline: 'IBIT + FBTC drive broad inflow breadth',
      timestamp: NOW - 4 * day, pnlPct: 3.1 },
    { id: 's4', asset: 'BTC', direction: 'BEARISH', confidence: 61,
      headline: 'Short-term outflow cluster; macro risk-off',
      timestamp: NOW - 6 * day, pnlPct: 1.8 },
  ];
}

export function getMockNews(): { list: NewsItem[]; total: string } {
  const list: NewsItem[] = MOCK_HEADLINES.map((h, i) => ({
    id: `mock-${i}`,
    sourceLink: 'https://sosovalue.com',
    releaseTime: min(h.minsAgo),
    author: h.author || 'SoSoValue',
    category: h.category,
    featureImage: '',
    matchedCurrencies: h.currencies || [],
    tags: h.tags,
    multilanguageContent: [{ language: 'en', title: h.title, content: h.title }],
  }));
  return { list, total: String(list.length) };
}
