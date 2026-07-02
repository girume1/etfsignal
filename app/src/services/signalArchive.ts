import type { HistoricalSignal, HourlyCandle } from '../types';
import { runBacktest } from './backtester';
import { fetchSignalHistory } from './sosovalue';

const HISTORY_KEY = 'etfsignal:history';
const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Persists a newly generated signal (localStorage always, Redis best-effort).
 * Caller sets outcome: 'PENDING' / pnlReal: false for direction-bearing signals.
 */
export async function saveSignal(signal: HistoricalSignal): Promise<void> {
  const existing: HistoricalSignal[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  localStorage.setItem(HISTORY_KEY, JSON.stringify([signal, ...existing].slice(0, 20)));

  // ponytail: no separate retry queue for the POST — the localStorage write above
  // is the durable copy; fetchSignalHistory() already falls back to it when Redis
  // is unreachable, so a failed POST here just means Redis stays behind until the
  // next successful save.
  await fetch('/api/signal-archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signal),
  }).catch(() => {});
}

async function fetchHourlyCandles(
  asset: 'BTC' | 'ETH',
  startTime: number,
  endTime: number,
): Promise<HourlyCandle[]> {
  const symbol = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${symbol}&interval=1h&startTime=${startTime}&endTime=${endTime}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);

  const raw: [number, string, string, string, string, ...unknown[]][] = await res.json();
  return raw.map((k) => ({ time: k[0], high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
}

/**
 * Evaluates PENDING signals ≥24h old against real Binance hourly candles and
 * PATCHes the outcome back to the archive. A signal whose kline fetch or PATCH
 * fails simply stays PENDING and is retried on the next call — no separate
 * sync-flag bookkeeping needed since eligibility is re-derived from archive state.
 */
export async function evaluatePendingSignals(): Promise<void> {
  const all = await fetchSignalHistory();
  const now = Date.now();
  const eligible = all.filter(
    (s) =>
      s.outcome === 'PENDING' &&
      s.direction !== 'NEUTRAL' &&
      s.tpPrice != null &&
      s.slPrice != null &&
      s.entryPrice != null &&
      now - s.timestamp >= MS_24H,
  );

  for (const sig of eligible) {
    try {
      const candles = await fetchHourlyCandles(sig.asset, sig.timestamp, sig.timestamp + MS_24H);
      const [result] = runBacktest(
        [
          {
            id: sig.id,
            direction: sig.direction as 'BULLISH' | 'BEARISH',
            confidence: sig.confidence,
            entryPrice: sig.entryPrice!,
            tpPrice: sig.tpPrice!,
            slPrice: sig.slPrice!,
            timestamp: sig.timestamp,
          },
        ],
        candles,
      ).perSignal;

      await fetch('/api/signal-archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sig.id,
          outcome: result.outcome,
          pnlPct: result.pnlPct,
          pnlReal: true,
          evaluatedAt: result.evaluatedAt,
        }),
      });
    } catch {
      // Binance fetch or Redis PATCH failed — stays PENDING, retried next cycle.
    }
  }
}
