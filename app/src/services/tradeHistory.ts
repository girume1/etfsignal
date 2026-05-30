// localStorage-backed trade execution history.
// Stores up to 50 trades, newest first.

import type { TradeRecord } from '../types';

const TRADE_HISTORY_KEY = 'etfsignal:trades';

export function saveTrade(record: TradeRecord): void {
  const existing = getTradeHistory();
  localStorage.setItem(
    TRADE_HISTORY_KEY,
    JSON.stringify([record, ...existing].slice(0, 50)),
  );
}

export function getTradeHistory(): TradeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(TRADE_HISTORY_KEY) ?? '[]') as TradeRecord[];
  } catch {
    return [];
  }
}

export function clearTradeHistory(): void {
  localStorage.removeItem(TRADE_HISTORY_KEY);
}
