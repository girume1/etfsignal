import type { EtfData, EtfType, NewsItem, Alert, HistoricalSignal } from '../types';
import {
  getMockEtfData, getMockNews, getMockHistory,
  getMockPriceHistory, getMockAlerts, getMockSignalHistory,
} from './mockData';
import type { HistoricalInflow, PricePoint } from './mockData';

export type { HistoricalInflow, PricePoint } from './mockData';

const ETF_BASE  = 'https://api.sosovalue.xyz';
const BASE_URL  = 'https://openapi.sosovalue.com';

/**
 * All SoSoValue calls go through /api/sosovalue (Vercel Edge Function).
 * The real API key lives server-side only — never bundled into the browser.
 *
 * On the first request, if the server has no key it returns { noKey: true }
 * and we flip runtimeDegradedToMock so the rest of the session uses mocks.
 */
let runtimeDegradedToMock = false;

export const isMockMode   = false; // determined at runtime via proxy
export const mockReason = (): 'no-key' | 'degraded' | null =>
  runtimeDegradedToMock ? 'degraded' : null;

function useMocks(): boolean {
  return runtimeDegradedToMock;
}

function simulate<T>(value: T, ms = 450): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function degradeAndWarn(err: unknown, endpoint: string): void {
  if (!runtimeDegradedToMock) {
    runtimeDegradedToMock = true;
    console.warn(
      `[sosovalue] ${endpoint} failed, falling back to mock data:`,
      err,
    );
  }
}

// ─── Proxy helper ─────────────────────────────────────────────────────────────

interface ProxyOpts {
  method: 'GET' | 'POST';
  url: string;
  body?: unknown;
  params?: Record<string, string | number>;
}

async function sosoProxy<T>(opts: ProxyOpts): Promise<T | null> {
  const res = await fetch('/api/sosovalue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const json: any = await res.json();

  if (json.noKey) {
    // Server has no key → stay in mock mode for this session
    runtimeDegradedToMock = true;
    return null;
  }

  if (!res.ok) throw new Error(json.msg || `SoSoValue error ${res.status}`);
  return json as T;
}

// ─── ETF Metrics ──────────────────────────────────────────────────────────────

export async function fetchEtfMetrics(type: EtfType): Promise<EtfData> {
  if (useMocks()) return simulate(getMockEtfData(type));

  try {
    const json: any = await sosoProxy({
      method: 'POST',
      url: `${ETF_BASE}/openapi/v2/etf/currentEtfDataMetrics`,
      body: { type },
    });
    if (!json) return getMockEtfData(type);         // noKey → mock
    if (json.code !== 0) throw new Error(json.msg || 'ETF API error');
    return json.data as EtfData;
  } catch (err) {
    degradeAndWarn(err, 'fetchEtfMetrics');
    return getMockEtfData(type);
  }
}

// ─── Historical Inflows ───────────────────────────────────────────────────────

export async function fetchHistoricalInflows(
  type: EtfType,
  days = 14,
): Promise<HistoricalInflow[]> {
  // Historical endpoint wired in Wave 2 — mocks for now
  if (useMocks()) return simulate(getMockHistory(type, days));
  return getMockHistory(type, days);
}

// ─── Price History ────────────────────────────────────────────────────────────

export async function fetchPriceHistory(
  type: EtfType,
  days = 14,
): Promise<PricePoint[]> {
  if (useMocks()) return simulate(getMockPriceHistory(type, days));
  return getMockPriceHistory(type, days);
}

// ─── Smart Alerts ─────────────────────────────────────────────────────────────

export async function fetchAlerts(): Promise<Alert[]> {
  if (useMocks()) return simulate(getMockAlerts());
  return getMockAlerts();
}

// ─── Signal History ───────────────────────────────────────────────────────────

export async function fetchSignalHistory(): Promise<HistoricalSignal[]> {
  if (useMocks()) return simulate(getMockSignalHistory());
  return getMockSignalHistory();
}

// ─── News Feed ────────────────────────────────────────────────────────────────

export async function fetchNews(params: {
  pageNum?: number;
  pageSize?: number;
  categoryList?: number[];
}): Promise<{ list: NewsItem[]; total: string }> {
  if (useMocks()) return simulate(getMockNews());

  try {
    const { pageNum = 1, pageSize = 20, categoryList = [1, 2, 3, 4, 5, 6, 7, 9, 10] } = params;
    const json: any = await sosoProxy({
      method: 'GET',
      url: `${BASE_URL}/api/v1/news/featured`,
      params: {
        pageNum,
        pageSize,
        categoryList: categoryList.join(','),
      },
    });
    if (!json) return getMockNews();                // noKey → mock
    if (json.code !== 0) throw new Error(json.msg || 'News API error');
    return json.data as { list: NewsItem[]; total: string };
  } catch (err) {
    degradeAndWarn(err, 'fetchNews');
    return getMockNews();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatUSD(value: number | null): string {
  if (value === null) return '—';
  const abs  = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

export function getNewsTitle(item: NewsItem): string {
  const en = item.multilanguageContent.find(c => c.language === 'en');
  return en?.title || item.multilanguageContent[0]?.title || 'Untitled';
}
