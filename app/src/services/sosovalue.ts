import type { EtfData, EtfType, NewsItem, HistoricalSignal } from '../types';
export type { HistoricalInflow, PricePoint } from '../types';
import type { HistoricalInflow, PricePoint } from '../types';

// openapi.sosovalue.com works from Vercel Node.js functions (no network restriction).
// api.sosovalue.xyz is kept as fallback for any endpoint not available on the primary host.
const ETF_BASE = 'https://openapi.sosovalue.com';
const ETF_BASE_ALT = 'https://api.sosovalue.xyz';
const BASE_URL = 'https://openapi.sosovalue.com';

// ─── Proxy helper ─────────────────────────────────────────────────────────────

interface ProxyOpts {
  method: 'GET' | 'POST';
  url: string;
  body?: unknown;
  params?: Record<string, string | number>;
}

async function sosoProxy<T>(opts: ProxyOpts): Promise<T> {
  const res = await fetch('/api/sosovalue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const json: any = await res.json();

  if (!res.ok) throw new Error(json.error || json.msg || `SoSoValue error ${res.status}`);
  return json as T;
}

// ─── ETF Metrics ──────────────────────────────────────────────────────────────

export async function fetchEtfMetrics(type: EtfType): Promise<EtfData> {
  const json: any = await sosoProxy({
    method: 'POST',
    url: `${ETF_BASE}/openapi/v2/etf/currentEtfDataMetrics`,
    body: { type },
  });
  if (json.code !== 0) throw new Error(json.msg || 'ETF API error');
  return json.data as EtfData;
}

// ─── Historical Inflows ───────────────────────────────────────────────────────

export async function fetchHistoricalInflows(
  type: EtfType,
  days = 14,
): Promise<HistoricalInflow[]> {
  // Try primary host first, fall back to alt host
  for (const base of [ETF_BASE, ETF_BASE_ALT]) {
    try {
      const json: any = await sosoProxy({
        method: 'GET',
        url: `${base}/openapi/v2/etf/etfNetInflowHistory`,
        params: { type, days },
      });
      if (json.code === 0) return json.data as HistoricalInflow[];
    } catch {
      // try next host
    }
  }
  return []; // graceful empty — sentiment gauge shows "Insufficient data"
}

// ─── Price History ────────────────────────────────────────────────────────────
// Binance WebSocket is the live price source; this endpoint is unused in production.

export async function fetchPriceHistory(
  _type: EtfType,
  _days = 14,
): Promise<PricePoint[]> {
  return [];
}

// ─── Smart Alerts ─────────────────────────────────────────────────────────────
// Alerts are derived in DashboardContext (task 6); this function is a no-op stub.

export async function fetchAlerts(): Promise<[]> {
  return [];
}

// ─── Signal History ───────────────────────────────────────────────────────────
// Signal history is persisted in localStorage by DashboardContext (task 7).

export async function fetchSignalHistory(): Promise<HistoricalSignal[]> {
  try {
    const raw = localStorage.getItem('etfsignal:history');
    return raw ? (JSON.parse(raw) as HistoricalSignal[]) : [];
  } catch {
    return [];
  }
}

// ─── News Feed ────────────────────────────────────────────────────────────────

export async function fetchNews(params: {
  pageNum?: number;
  pageSize?: number;
  categoryList?: number[];
}): Promise<{ list: NewsItem[]; total: string }> {
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
  // SoSoValue news API returns code:200 for success (unlike ETF API which uses code:0)
  const ok = json.code === 0 || json.code === 200;
  if (!ok) throw new Error(json.msg || json.message || `News API error (code ${json.code})`);
  // Response may be { data: { list, total } } or { data: [...] } or { list: [...] }
  const payload = json.data ?? json;
  const list: NewsItem[] = Array.isArray(payload) ? payload : (payload.list ?? payload.records ?? []);
  const total: string = String(payload.total ?? list.length);
  return { list, total };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatUSD(value: number | null): string {
  if (value === null) return '—';
  const abs  = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

export function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

export function getNewsTitle(item: NewsItem): string {
  const en = item.multilanguageContent.find(c => c.language === 'en');
  return en?.title || item.multilanguageContent[0]?.title || 'Untitled';
}
