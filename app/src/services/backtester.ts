import type {
  BacktestSignalInput,
  HourlyCandle,
  BacktestResult,
  SignalBacktestResult,
  SignalOutcome,
} from '../types';

const MS_PER_24H = 86_400_000;

/**
 * Evaluates a single signal against a set of hourly candles.
 * Candles must already be filtered to the relevant 24h window and sorted chronologically.
 */
function evaluateSignal(
  signal: BacktestSignalInput,
  windowCandles: HourlyCandle[],
): SignalBacktestResult {
  const { id, direction, entryPrice, tpPrice, slPrice, timestamp } = signal;

  // Guard: missing or invalid prices → EXPIRED with pnlPct = 0
  if (!entryPrice || entryPrice === 0 || !tpPrice || !slPrice) {
    return {
      id,
      outcome: 'EXPIRED',
      pnlPct: 0,
      evaluatedAt: timestamp + MS_PER_24H,
    };
  }

  let outcome: SignalOutcome = 'EXPIRED';
  let evaluatedAt = timestamp + MS_PER_24H;

  for (const candle of windowCandles) {
    let tpHit = false;
    let slHit = false;

    if (direction === 'BULLISH') {
      tpHit = candle.high >= tpPrice;
      slHit = candle.low <= slPrice;
    } else {
      // BEARISH
      tpHit = candle.low <= tpPrice;
      slHit = candle.high >= slPrice;
    }

    if (tpHit && slHit) {
      // Same-candle collision → MISS (worst-case assumption)
      outcome = 'MISS';
      evaluatedAt = candle.time;
      break;
    }

    if (tpHit) {
      outcome = 'HIT';
      evaluatedAt = candle.time;
      break;
    }

    if (slHit) {
      outcome = 'MISS';
      evaluatedAt = candle.time;
      break;
    }
  }

  const pnlPct = computePnl(direction, outcome, entryPrice, tpPrice, slPrice);

  return { id, outcome, pnlPct, evaluatedAt };
}

/**
 * Computes P&L percentage based on direction, outcome, and prices.
 */
function computePnl(
  direction: 'BULLISH' | 'BEARISH',
  outcome: SignalOutcome,
  entryPrice: number,
  tpPrice: number,
  slPrice: number,
): number {
  if (outcome === 'EXPIRED') return 0;

  let raw: number;

  if (direction === 'BULLISH') {
    if (outcome === 'HIT') {
      raw = ((tpPrice - entryPrice) / entryPrice) * 100;
    } else {
      // MISS
      raw = ((slPrice - entryPrice) / entryPrice) * 100;
    }
  } else {
    // BEARISH
    if (outcome === 'HIT') {
      raw = ((entryPrice - tpPrice) / entryPrice) * 100;
    } else {
      // MISS
      raw = ((entryPrice - slPrice) / entryPrice) * 100;
    }
  }

  return Math.round(raw * 100) / 100;
}

/**
 * Aggregate stats over resolved outcomes. maxDrawdown is the largest
 * peak-to-trough decline on the running cumulative P&L equity curve.
 */
function computeAggregates(perSignal: SignalBacktestResult[]): BacktestResult['aggregates'] {
  const totalCount = perSignal.length;
  if (totalCount === 0) {
    return { totalCount: 0, hitRate: 0, avgPnl: 0, cumPnl: 0, maxDrawdown: 0 };
  }

  const hitCount = perSignal.filter((s) => s.outcome === 'HIT').length;
  const cumPnl = perSignal.reduce((sum, s) => sum + s.pnlPct, 0);

  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const s of perSignal) {
    running += s.pnlPct;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  return {
    totalCount,
    hitRate: (hitCount / totalCount) * 100,
    avgPnl: cumPnl / totalCount,
    cumPnl,
    maxDrawdown,
  };
}

/**
 * Runs the backtester for all signals against the provided candle set.
 */
export function runBacktest(
  signals: BacktestSignalInput[],
  candles: HourlyCandle[],
): BacktestResult {
  // Sort candles chronologically once (defensive — callers should provide sorted data)
  const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

  const perSignal: SignalBacktestResult[] = signals.map((signal) => {
    const windowStart = signal.timestamp;
    const windowEnd = signal.timestamp + MS_PER_24H;

    const windowCandles = sortedCandles.filter(
      (c) => c.time >= windowStart && c.time < windowEnd,
    );

    return evaluateSignal(signal, windowCandles);
  });

  return { perSignal, aggregates: computeAggregates(perSignal) };
}
