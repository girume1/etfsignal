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

  const res = await fetch(`https://api.chart-img.com/v1/tradingview/advanced-chart?${params}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`chart-img ${res.status}: ${txt.slice(0, 100)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─── QuickChart fallback — Bybit → Kraken → OKX ──────────────────────────────

interface Candle { t: number; o: number; h: number; l: number; c: number }

async function fromBybit(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const ivMap: Record<string, string> = { '1m': '1', '1h': '60', '4h': '240' };
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  for (const fn of [fromBybit, fromKraken, fromOKX]) {
    try {
      const c = await fn(symbol, interval, limit);
      if (c.length > 0) return c;
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
  const res = await fetch('https://quickchart.io/chart', {
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

  const chartImgKey = process.env.CHARTIMG_API_KEY ?? '';
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
      console.warn('[chart] chart-img failed, falling back to QuickChart:', err.message);
      // Fall through to QuickChart
    }
  }

  // ── Mode 2: QuickChart candlestick ────────────────────────────────────────
  let candles: Candle[];
  try {
    candles = await fetchCandles(symbol, interval, limit);
  } catch (err: any) {
    return res.status(502).json({ error: `Candle fetch failed: ${err.message}` });
  }

  const last  = candles[candles.length - 1]?.c ?? 0;
  const first = candles[0]?.c ?? last;
  const pct   = first ? ((last - first) / first) * 100 : 0;

  let img: Buffer;
  try {
    img = await renderQuickChart(symbol, interval, candles);
  } catch (err: any) {
    return res.status(502).json({ error: `Chart render failed: ${err.message}` });
  }

  res.setHeader('Content-Type',  'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  res.setHeader('X-Pct',         pct.toFixed(2));
  res.setHeader('X-Trending',    pct >= 0 ? '1' : '0');
  return res.send(img);
}
