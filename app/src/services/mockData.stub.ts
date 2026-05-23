// ─── Production stub for mockData.ts ─────────────────────────────────────
// This file is aliased over mockData.ts in production builds via vite.config.ts.
// All functions throw so that any accidental import of mock data is caught at
// runtime rather than silently serving stale demo numbers.

import type { EtfType } from '../types';

// Re-export types so any import of { HistoricalInflow, PricePoint } from './mockData'
// continues to compile in both dev and production.
export type { HistoricalInflow, PricePoint } from '../types';

// ─── Stub constants ───────────────────────────────────────────────────────
// These are typed to match the originals but are never actually used in
// production; they exist only to satisfy static imports.
export const MOCK_BTC_ETF: never = null as never;
export const MOCK_ETH_ETF: never = null as never;

// ─── Stub functions ───────────────────────────────────────────────────────
const disabled = (): never => {
  throw new Error('Mock data disabled in production');
};

export function getMockEtfData(_type: EtfType): never {
  return disabled();
}

export function getMockHistory(_type: EtfType, _days?: number): never {
  return disabled();
}

export function getMockPriceHistory(_type: EtfType, _days?: number): never {
  return disabled();
}

export function computeSentiment(_inflows: number[]): never {
  return disabled();
}

export function getMockAlerts(): never {
  return disabled();
}

export function getMockSignalHistory(): never {
  return disabled();
}

export function getMockNews(): never {
  return disabled();
}
