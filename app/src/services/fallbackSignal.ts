import type { EtfData, MarketSignal, SignalDirection, SignalWeight } from '../types';
import { computeSentiment } from './sentiment';
import { formatUSD } from './sosovalue';

export interface FallbackSignalInput {
  asset: 'BTC' | 'ETH';
  etfData: EtfData;
  /** Daily inflow history ordered oldest-first (at least last 14 days when available). */
  inflows?: number[];
  currentPrice?: number | null;
  /** Optional Average True Range in USD; when provided (> 0), TP/SL use ATR multiples. */
  atr?: number | null;
  degradedReason?: string;
}

const DEFAULT_PRICES: Record<'BTC' | 'ETH', number> = {
  BTC: 95_000,
  ETH: 3_200,
};

const DAILY_FLOW_THRESHOLD: Record<'BTC' | 'ETH', number> = {
  BTC: 25_000_000,
  ETH: 10_000_000,
};

const MAX_FALLBACK_CONFIDENCE = 60;

/**
 * Pure, deterministic rule-based MarketSignal generator used whenever the live
 * AI provider is overloaded, rate-limited, timed out, or in circuit cooldown.
 */
export function buildFallbackSignal(input: FallbackSignalInput): MarketSignal {
  const { asset, etfData } = input;
  const dailyInflow = etfData.dailyNetInflow.value;
  const cumInflow = etfData.cumNetInflow.value;

  const recentInflows = (input.inflows && input.inflows.length > 0
    ? input.inflows.slice(-14)
    : (dailyInflow !== null ? [dailyInflow] : []))
    .filter((v) => Number.isFinite(v));

  const sentiment = computeSentiment(recentInflows);
  const net14d = recentInflows.reduce((sum, v) => sum + v, 0);

  // Breadth across issuers with non-null daily inflow
  const activeFunds = etfData.list.filter((f) => f.dailyNetInflow.value !== null);
  const posFunds = activeFunds.filter((f) => (f.dailyNetInflow.value ?? 0) > 0).length;
  const negFunds = activeFunds.filter((f) => (f.dailyNetInflow.value ?? 0) < 0).length;

  // Threshold votes from daily flow + sentiment + 14d momentum
  const flowThresh = DAILY_FLOW_THRESHOLD[asset];
  const dailyVote = dailyInflow === null
    ? 0
    : dailyInflow >= flowThresh
      ? 1
      : dailyInflow <= -flowThresh
        ? -1
        : 0;

  const sentimentVote = sentiment.score >= 58 ? 1 : sentiment.score <= 42 ? -1 : 0;
  const momentumVote = sentiment.momentum >= 0.15 ? 0.5 : sentiment.momentum <= -0.15 ? -0.5 : 0;
  const compositeScore = dailyVote + sentimentVote + momentumVote;

  let direction: SignalDirection = 'NEUTRAL';
  if (compositeScore >= 0.75) direction = 'BULLISH';
  else if (compositeScore <= -0.75) direction = 'BEARISH';

  // Rule-based confidence strictly capped at 60
  const rawConf = direction === 'NEUTRAL'
    ? 44 + Math.min(8, Math.round(Math.abs(compositeScore) * 10))
    : 48 + Math.min(12, Math.round(Math.abs(compositeScore) * 6));
  const confidence = Math.max(35, Math.min(MAX_FALLBACK_CONFIDENCE, rawConf));

  const hasLivePrice = Boolean(input.currentPrice && input.currentPrice > 0 && Number.isFinite(input.currentPrice));
  const anchorPrice = hasLivePrice ? (input.currentPrice as number) : DEFAULT_PRICES[asset];
  const priceDecimals = anchorPrice >= 1000 ? 0 : 2;
  const roundPx = (p: number) => Number(p.toFixed(priceDecimals));

  const hasAtr = Boolean(input.atr && input.atr > 0 && Number.isFinite(input.atr));
  let tpPctMag: number;
  let slPctMag: number;
  let tpRationale: string;
  let slRationale: string;

  if (hasAtr) {
    const atr = input.atr as number;
    const tpMult = direction === 'NEUTRAL' ? 1.8 : 2.2;
    const slMult = direction === 'NEUTRAL' ? 1.0 : 1.2;
    tpPctMag = Number((((atr * tpMult) / anchorPrice) * 100).toFixed(2));
    slPctMag = Number((((atr * slMult) / anchorPrice) * 100).toFixed(2));
    tpRationale = `Rule-based ${tpMult}x ATR ($${roundPx(atr).toLocaleString()}) volatility target.`;
    slRationale = `Rule-based ${slMult}x ATR ($${roundPx(atr).toLocaleString()}) protective invalidation.`;
  } else {
    tpPctMag = direction === 'NEUTRAL' ? 3.0 : 4.5;
    slPctMag = direction === 'NEUTRAL' ? 2.0 : 2.5;
    tpRationale = `Fixed +${tpPctMag.toFixed(1)}% quantitative fallback target.`;
    slRationale = `Fixed -${slPctMag.toFixed(1)}% quantitative fallback stop limit.`;
  }

  const isBearish = direction === 'BEARISH';
  const tpPrice = roundPx(anchorPrice * (isBearish ? 1 - tpPctMag / 100 : 1 + tpPctMag / 100));
  const slPrice = roundPx(anchorPrice * (isBearish ? 1 + slPctMag / 100 : 1 - slPctMag / 100));

  const flowSignal = dailyVote > 0 ? 'positive' : dailyVote < 0 ? 'negative' : 'neutral';
  const momSignal = sentiment.momentum > 0.1 ? 'positive' : sentiment.momentum < -0.1 ? 'negative' : 'neutral';
  const cumSignal = cumInflow === null ? 'neutral' : cumInflow >= 0 ? 'positive' : 'negative';
  const breadthSignal = posFunds > negFunds ? 'positive' : negFunds > posFunds ? 'negative' : 'neutral';

  // Fixed integer weights guaranteed to sum to exactly 100
  const weights: SignalWeight[] = [
    { factor: 'ETF Daily Inflow',      weight: 35, signal: flowSignal },
    { factor: '14D Flow Momentum',     weight: 30, signal: momSignal },
    { factor: 'Cumulative Flow Trend', weight: 20, signal: cumSignal },
    { factor: 'Fund Breadth',          weight: 15, signal: breadthSignal },
  ];

  const flowLabel = formatUSD(dailyInflow);
  const net14dLabel = recentInflows.length > 0 ? formatUSD(net14d) : '—';
  const headline = direction === 'BULLISH'
    ? `Rule-based: ${asset} ETF inflows (${flowLabel}) support upward bias`
    : direction === 'BEARISH'
      ? `Rule-based: ${asset} ETF outflows (${flowLabel}) indicate distribution pressure`
      : `Rule-based: Mixed ${asset} ETF flows (${flowLabel}) point to range-bound action`;

  const summary =
    `Deterministic fallback computed from local ETF and sentiment inputs while AI is unavailable. ` +
    `${asset} daily net flow is ${flowLabel}, 14-day cumulative sample is ${net14dLabel}, ` +
    `and flow sentiment scores ${sentiment.score}/100 (${sentiment.label.toLowerCase()}).`;

  const topLead = [...activeFunds]
    .sort((a, b) => Math.abs(b.dailyNetInflow.value ?? 0) - Math.abs(a.dailyNetInflow.value ?? 0))[0];

  return {
    direction,
    confidence,
    headline,
    summary,
    keyFactors: [
      `Daily ${asset} ETF net flow: ${flowLabel}`,
      `14D flow sentiment: ${sentiment.score}/100 (${sentiment.label})`,
      topLead
        ? `Lead issuer flow: ${topLead.ticker} (${formatUSD(topLead.dailyNetInflow.value)})`
        : `Fund breadth: ${posFunds} positive vs ${negFunds} negative issuers`,
    ],
    tradeIdea: direction === 'BEARISH'
      ? `Cautious short setup on SoDEX ${asset}-USDC near $${roundPx(anchorPrice).toLocaleString()} with strict -${slPctMag.toFixed(1)}% stop.`
      : direction === 'BULLISH'
        ? `Constructive long bias on SoDEX ${asset}-USDC near $${roundPx(anchorPrice).toLocaleString()} targeting +${tpPctMag.toFixed(1)}%.`
        : `Remain patient or trade smaller size on SoDEX ${asset}-USDC until flow direction clarifies.`,
    riskWarning: 'Rule-based quantitative fallback (AI unavailable). Confidence is capped at 60%; verify conditions manually before trading.',
    entryZone: {
      low: roundPx(anchorPrice * 0.994),
      high: roundPx(anchorPrice * 1.006),
    },
    takeProfit: {
      price: tpPrice,
      pct: tpPctMag,
      rationale: tpRationale,
    },
    stopLoss: {
      price: slPrice,
      pct: -slPctMag,
      rationale: slRationale,
    },
    weights,
    timestamp: new Date(),
    source: 'fallback',
    degradedReason: input.degradedReason ?? 'AI provider unavailable — showing rule-based fallback.',
  };
}
