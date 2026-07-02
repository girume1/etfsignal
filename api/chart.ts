// Vercel Node.js Serverless Function — Chart image generator
//
// Mode 1 — chart-img.com (requires CHARTIMG_API_KEY env var):
//   Generates real TradingView-style candlestick charts via chart-img.com API.
//   Free tier: 100 calls/month. No IP restrictions.
//   https://chart-img.com
//
// Mode 2 — QuickChart fallback (no API key needed):
//   Fetches OHLC from Bybit/Kraken/OKX and renders via QuickChart.io
//
// Query params:
//   cmd      — ch | chb | che | tv_btc | tv_eth  (chart-img mode)
//   symbol   — BTCUSDT | ETHUSDT                  (QuickChart fallback)
//   interval — 1m | 1h                            (QuickChart fallback)

// ─── Timeout helper ──────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000;

/**
 * Wraps a fetch call with an AbortController-based timeout.
 * Throws a DOMException with name "AbortError" if the timeout fires before
 * the fetch resolves, which callers can detect via `err.name === "AbortError"`.
 */
function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

// ─── chart-img.com config ─────────────────────────────────────────────────────
// TradingView symbol format: EXCHANGE:PAIR  or  EXCHANGE_PERP:PAIR.P for perps

const CHART_IMG_CONFIG: Record<string, { symbol: string; interval: string; label: string }> = {
  ch:     { symbol: 'BINANCE:BTCUSDT',        interval: '1',  label: 'BTC/USDT 1m'  },
  chb:    { symbol: 'BINANCE_PERP:BTCUSDT.P', interval: '1',  label: 'BTC Perp 1m'  },
  che:    { symbol: 'BINANCE_PERP:ETHUSDT.P', interval: '1',  label: 'ETH Perp 1m'  },
  tv_btc: { symbol: 'BINANCE:BTCUSDT',        interval: '60', label: 'BTC/USDT 1h'  },
  tv_eth: { symbol: 'BINANCE:ETHUSDT',        interval: '60', label: 'ETH/USDT 1h'  },
};

async function fetchChartImg(cmd: string, apiKey: string): Promise<Buffer> {
  const cfg = CHART_IMG_CONFIG[cmd];
  if (!cfg) throw new Error(`Unknown chart command: ${cmd}`);

  // Free tier allows max 3 parameters: key + symbol + interval
  const params = new URLSearchParams({
    key:      apiKey,
    symbol:   cfg.symbol,
    interval: cfg.interval,
  });

  const res = await fetchWithTimeout(`https://api.chart-img.com/v1/tradingview/advanced-chart?${params}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`chart-img ${res.status}: ${txt.slice(0, 100)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─── QuickChart fallback — Binance → Bybit → Kraken → OKX ────────────────────

interface Candle { t: number; o: number; h: number; l: number; c: number }
type SourceName = 'binance' | 'bybit' | 'kraken' | 'okx';

/** Thrown when Binance returns an explicit non-2xx HTTP response (fallback allowed). */
class HttpStatusError extends Error {
  constructor(public status: number) { super(`HTTP ${status}`); }
}

/** Thrown when Binance is unreachable (no HTTP response) — fallback is skipped entirely. */
class UpstreamUnavailableError extends Error {}

async function fromBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const ivMap: Record<string, string> = { '1m': '1m', '1h': '1h', '4h': '4h' };
  const res = await fetchWithTimeout(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${ivMap[interval] ?? '1m'}&limit=${limit}`,
  );
  if (!res.ok) throw new HttpStatusError(res.status);
  const raw: [number, string, string, string, string, ...unknown[]][] = await res.json();
  return raw.map((k) => ({
    t: k[0], o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

async function fromBybit(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const ivMap: Record<string, string> = { '1m': '1', '1h': '60', '4h': '240' };
  const res = await fetchWithTimeout(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${ivMap[interval] ?? '1'}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Bybit ${res.status}`);
  const json: any = await res.json();
  if (json.retCode !== 0 || !json.result?.list?.length) throw new Error('Bybit: no data');
  return (json.result.list as string[][]).reverse().map((k) => ({
    t: parseInt(k[0]), o: parseFloat(k[1]), h: parseFloat(k[2]),
    l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

async function fromKraken(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pairMap: Record<string, string> = { BTCUSDT: 'XBTUSD', ETHUSDT: 'ETHUSD' };
  const ivMap:   Record<string, string> = { '1m': '1', '1h': '60', '4h': '240' };
  const res = await fetchWithTimeout(
    `https://api.kraken.com/0/public/OHLC?pair=${pairMap[symbol] ?? 'XBTUSD'}&interval=${ivMap[interval] ?? '1'}`,
  );
  if (!res.ok) throw new Error(`Kraken ${res.status}`);
  const json: any = await res.json();
  if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`);
  const key = Object.keys(json.result).find((k) => k !== 'last')!;
  return (json.result[key] as any[]).slice(-limit).map((k) => ({
    t: k[0] * 1000, o: parseFloat(k[1]), h: parseFloat(k[2]),
    l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

async function fromOKX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const barMap: Record<string, string> = { '1m': '1m', '1h': '1H', '4h': '4H' };
  const res = await fetchWithTimeout(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol.replace('USDT', '-USDT')}&bar=${barMap[interval] ?? '1m'}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`OKX ${res.status}`);
  const json: any = await res.json();
  if (json.code !== '0' || !json.data?.length) throw new Error('OKX: no data');
  return (json.data as string[][]).reverse().map((k) => ({
    t: parseInt(k[0]), o: parseFloat(k[1]), h: parseFloat(k[2]),
    l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

/**
 * Binance is primary. An explicit non-2xx HTTP response from Binance falls
 * through to Bybit → Kraken → OKX. A connection failure or timeout (no HTTP
 * response at all) skips the fallback chain and throws UpstreamUnavailableError.
 */
async function fetchCandlesWithSource(
  symbol: string,
  interval: string,
  limit: number,
): Promise<{ candles: Candle[]; source: SourceName }> {
  try {
    const candles = await fromBinance(symbol, interval, limit);
    if (candles.length > 0) return { candles, source: 'binance' };
  } catch (err: any) {
    if (!(err instanceof HttpStatusError)) throw new UpstreamUnavailableError();
    // Explicit HTTP error from Binance — fall through to secondary sources below.
  }

  for (const [fn, source] of [[fromBybit, 'bybit'], [fromKraken, 'kraken'], [fromOKX, 'okx']] as const) {
    try {
      const candles = await fn(symbol, interval, limit);
      if (candles.length > 0) return { candles, source };
    } catch { /* try next */ }
  }
  throw new Error('All candle sources failed');
}

async function renderQuickChart(symbol: string, interval: string, candles: Candle[]): Promise<Buffer> {
  const cfg = {
    type: 'candlestick',
    data: {
      datasets: [{
        label: `${symbol} (${interval})`,
        data:  candles,
        color: {
          up:        'rgba(52,211,153,0.9)',
          down:      'rgba(248,113,113,0.9)',
          unchanged: 'rgba(148,163,184,0.6)',
        },
      }],
    },
    options: {
      scales: {
        xAxes: [{ ticks: { fontColor: '#64748B', maxTicksLimit: 8, maxRotation: 0 }, gridLines: { color: 'rgba(255,255,255,0.05)' } }],
        yAxes: [{ position: 'right', ticks: { fontColor: '#64748B' }, gridLines: { color: 'rgba(255,255,255,0.05)' } }],
      },
      legend: { labels: { fontColor: '#94A3B8', fontSize: 12 } },
    },
  };
  const res = await fetchWithTimeout('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart: cfg, width: 800, height: 450, backgroundColor: '#06080B', format: 'png', devicePixelRatio: 2 }),
  });
  if (!res.ok) throw new Error(`QuickChart ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Accept both CHARTIMG_API_KEY and CHARTING_API_KEY (common typo)
  const chartImgKey = process.env.CHARTIMG_API_KEY ?? process.env.CHARTING_API_KEY ?? '';
  const cmd         = req.query.cmd      as string | undefined;
  const symbol      = String(req.query.symbol   ?? 'BTCUSDT').toUpperCase();
  const interval    = String(req.query.interval ?? '1m');
  const limit       = Math.min(Number(req.query.limit ?? 60), 100);

  // ── Mode 1: chart-img.com (TradingView-style) ─────────────────────────────
  if (cmd && chartImgKey) {
    try {
      const img = await fetchChartImg(cmd, chartImgKey);
      res.setHeader('Content-Type',  'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(img);
    } catch (err: any) {
      // Any chart-img failure — including a timeout — falls through to the
      // independent Mode 2 fallback chain instead of failing the request outright.
      console.warn('[chart] chart-img failed, falling back to QuickChart:', err.message);
    }
  }

  // ── Mode 2: QuickChart candlestick ────────────────────────────────────────
  let candles: Candle[];
  let source: SourceName;
  try {
    const result = await fetchCandlesWithSource(symbol, interval, limit);
    candles = result.candles;
    source  = result.source;
  } catch (err: any) {
    // fetchCandlesWithSource classifies Binance connection failures/timeouts as
    // UpstreamUnavailableError before any fallback is attempted (Req 1.3); any
    // other failure here means every source in the chain was exhausted (Req 1.4).
    if (err instanceof UpstreamUnavailableError) {
      return res.status(502).json({ error: 'upstream_unavailable' });
    }
    return res.status(502).json({ error: 'all_sources_failed', sources_tried: ['binance', 'bybit', 'kraken', 'okx'] });
  }

  const last  = candles[candles.length - 1]?.c ?? 0;
  const first = candles[0]?.c ?? last;
  const pct   = first ? ((last - first) / first) * 100 : 0;

  let img: Buffer;
  try {
    img = await renderQuickChart(symbol, interval, candles);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(502).json({ error: 'timeout' });
    }
    return res.status(502).json({ error: `Chart render failed: ${err.message}` });
  }

  res.setHeader('Content-Type',  'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  res.setHeader('X-Pct',         pct.toFixed(2));
  res.setHeader('X-Trending',    pct >= 0 ? '1' : '0');
  res.setHeader('X-Source',      source);
  return res.send(img);
}
