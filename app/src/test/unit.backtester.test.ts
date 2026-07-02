import { describe, it, expect } from 'vitest';
import { runBacktest } from '../services/backtester';
import type { BacktestSignalInput, HourlyCandle } from '../types';

const baseSignal: BacktestSignalInput = {
  id: 's1',
  direction: 'BULLISH',
  confidence: 70,
  entryPrice: 100,
  tpPrice: 110,
  slPrice: 95,
  timestamp: 0,
};

const candle = (time: number, high: number, low: number, close: number): HourlyCandle => ({
  time,
  high,
  low,
  close,
});

describe('runBacktest', () => {
  it('BULLISH HIT: positive pnl matching (tp-entry)/entry*100', () => {
    const result = runBacktest([baseSignal], [candle(3_600_000, 112, 108, 111)]);
    expect(result.perSignal[0].outcome).toBe('HIT');
    expect(result.perSignal[0].pnlPct).toBeCloseTo(10, 2);
  });

  it('BEARISH MISS: negative pnl matching (entry-sl)/entry*100', () => {
    const bearish: BacktestSignalInput = { ...baseSignal, direction: 'BEARISH', tpPrice: 90, slPrice: 105 };
    const result = runBacktest([bearish], [candle(3_600_000, 106, 102, 104)]);
    expect(result.perSignal[0].outcome).toBe('MISS');
    expect(result.perSignal[0].pnlPct).toBeCloseTo(-5, 2);
  });

  it('same-candle TP+SL collision resolves to MISS', () => {
    const result = runBacktest([baseSignal], [candle(3_600_000, 115, 90, 100)]);
    expect(result.perSignal[0].outcome).toBe('MISS');
  });

  it('no candle in window resolves to EXPIRED with pnl 0', () => {
    const result = runBacktest([baseSignal], [candle(200_000_000, 112, 108, 111)]);
    expect(result.perSignal[0].outcome).toBe('EXPIRED');
    expect(result.perSignal[0].pnlPct).toBe(0);
  });

  it('empty signals array returns zeroed aggregates', () => {
    const result = runBacktest([], []);
    expect(result.perSignal).toEqual([]);
    expect(result.aggregates).toEqual({ totalCount: 0, hitRate: 0, avgPnl: 0, cumPnl: 0, maxDrawdown: 0 });
  });

  it('aggregates: hitRate, cumPnl, avgPnl, maxDrawdown over a known mix', () => {
    const s1: BacktestSignalInput = { ...baseSignal, id: 'a', timestamp: 0 };
    const s2: BacktestSignalInput = { ...baseSignal, id: 'b', timestamp: 100_000_000 };
    const candles = [
      candle(3_600_000, 112, 108, 111),        // hits s1 TP: +10
      candle(100_000_000 + 3_600_000, 96, 90, 92), // hits s2 SL: -5
    ];
    const result = runBacktest([s1, s2], candles);
    expect(result.aggregates.totalCount).toBe(2);
    expect(result.aggregates.hitRate).toBeCloseTo(50, 2);
    expect(result.aggregates.cumPnl).toBeCloseTo(5, 2);
    expect(result.aggregates.avgPnl).toBeCloseTo(2.5, 2);
    expect(result.aggregates.maxDrawdown).toBeCloseTo(5, 2); // peak +10 -> trough +5
  });
});
