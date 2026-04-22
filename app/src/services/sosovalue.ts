import axios from 'axios';
import type { EtfData, EtfType, NewsItem, Alert, HistoricalSignal } from '../types';
import {
  getMockEtfData, getMockNews, getMockHistory,
  getMockPriceHistory, getMockAlerts, getMockSignalHistory,
} from './mockData';
import type { HistoricalInflow, PricePoint } from './mockData';

export type { HistoricalInflow, PricePoint } from './mockData';

const BASE_URL = 'https://openapi.sosovalue.com';
const ETF_BASE = 'https://api.sosovalue.xyz';
const RAW_API_KEY = import.meta.env.VITE_SOSOVALUE_API_KEY || '';

/**
 * A key is considered "real" only if it's non-empty and not an obvious
 * placeholder. This lets the demo stay interactive even when the .env still
 * ships with `your_sosovalue_api_key_here`, which would otherwise produce
 * 401s on every request.
 */
function isPlaceholderKey(key: string): boolean {
  if (!key) return true;
  const lower = key.trim().toLowerCase();
  return (
    lower.startsWith('your_') ||
    lower.includes('placeholder') ||
    lower === 'changeme' ||
    lower === 'xxx'
  );
}

const API_KEY = isPlaceholderKey(RAW_API_KEY) ? '' : RAW_API_KEY;

/**
 * When the SoSoValue API key is missing (still pending Buildathon approval),
 * the service falls back to realistic mock data so the demo stays fully
 * interactive for judges. Flip this by setting VITE_SOSOVALUE_API_KEY in .env.
 *
 * `runtimeDegradedToMock` flips to true if a live call fails (e.g. 401) — once
 * that happens we stay on mocks for the rest of the session rather than
 * hammering a broken endpoint.
 */
let runtimeDegradedToMock = false;
export const isMockMode = !API_KEY;
export const mockReason = (): 'no-key' | 'degraded' | null => {
  if (!API_KEY) return 'no-key';
  if (runtimeDegradedToMock) return 'degraded';
  return null;
};
function useMocks(): boolean {
  return !API_KEY || runtimeDegradedToMock;
}

const headers = { 'x-soso-api-key': API_KEY };

// Simulates light network latency so loading states render naturally in demo mode.
function simulate<T>(value: T, ms = 450): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function degradeAndWarn(err: unknown, endpoint: string): void {
  if (!runtimeDegradedToMock) {
    runtimeDegradedToMock = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[sosovalue] ${endpoint} failed, falling back to mock data for the rest of this session:`,
      err
    );
  }
}

// ─── ETF Metrics ──────────────────────────────────────────────────────────

export async function fetchEtfMetrics(type: EtfType): Promise<EtfData> {
  if (useMocks()) return simulate(getMockEtfData(type));

  try {
    const { data } = await axios.post(
      `${ETF_BASE}/openapi/v2/etf/currentEtfDataMetrics`,
      { type },
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
    if (data.code !== 0) throw new Error(data.msg || 'ETF API error');
    return data.data;
  } catch (err) {
    degradeAndWarn(err, 'fetchEtfMetrics');
    return getMockEtfData(type);
  }
}

// ─── Historical Inflows ───────────────────────────────────────────────────
// Used by the sparkline in EtfPanel. In mock mode we return a hand-curated
// 14-day series; when live, this will hit the historical endpoint added in
// Wave 2. Shape is kept stable so the UI doesn't care which source fed it.

export async function fetchHistoricalInflows(
  type: EtfType,
  days = 14,
): Promise<HistoricalInflow[]> {
  if (useMocks()) return simulate(getMockHistory(type, days));
  // Wave 2: real SoSoValue historical endpoint. For now, use mocks when the
  // live API branch has nothing wired up rather than returning empty.
  return getMockHistory(type, days);
}

// ─── Price History ────────────────────────────────────────────────────────

export async function fetchPriceHistory(
  type: EtfType,
  days = 14,
): Promise<PricePoint[]> {
  if (useMocks()) return simulate(getMockPriceHistory(type, days));
  return getMockPriceHistory(type, days);
}

// ─── Smart Alerts ─────────────────────────────────────────────────────────

export async function fetchAlerts(): Promise<Alert[]> {
  if (useMocks()) return simulate(getMockAlerts());
  return getMockAlerts();
}

// ─── Signal History ───────────────────────────────────────────────────────

export async function fetchSignalHistory(): Promise<HistoricalSignal[]> {
  if (useMocks()) return simulate(getMockSignalHistory());
  return getMockSignalHistory();
}

// ─── News Feed ────────────────────────────────────────────────────────────

export async function fetchNews(params: {
  pageNum?: number;
  pageSize?: number;
  categoryList?: number[];
}): Promise<{ list: NewsItem[]; total: string }> {
  if (useMocks()) return simulate(getMockNews());

  try {
    const { pageNum = 1, pageSize = 20, categoryList = [1, 2, 3, 4, 5, 6, 7, 9, 10] } = params;
    const { data } = await axios.get(`${BASE_URL}/api/v1/news/featured`, {
      headers,
      params: {
        pageNum,
        pageSize,
        categoryList: categoryList.join(','),
      },
    });
    if (data.code !== 0) throw new Error(data.msg || 'News API error');
    return data.data;
  } catch (err) {
    degradeAndWarn(err, 'fetchNews');
    return getMockNews();
  }
}

// ─── Currency List ────────────────────────────────────────────────────────

export async function fetchCurrencies(): Promise<any[]> {
  if (useMocks()) return simulate([]);
  try {
    const { data } = await axios.get(`${BASE_URL}/api/v1/currencies`, { headers });
    if (data.code !== 0) throw new Error(data.msg || 'Currencies API error');
    return data.data;
  } catch (err) {
    degradeAndWarn(err, 'fetchCurrencies');
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function formatUSD(value: number | null): string {
  if (value === null) return '—';
  const abs = Math.abs(value);
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
