// Vercel Node.js Serverless Function — Chart image generator
//
// Mode 1 — Exchange screenshot (requires SCREENSHOTONE_ACCESS_KEY env var):
//   GET /api/chart?cmd=ch|chb|che|tv_btc|tv_eth
//   Takes a screenshot of the configured exchange chart page via screenshotone.com
//
// Mode 2 — QuickChart candlestick (fallback, no API key needed):
//   GET /api/chart?symbol=BTCUSDT&interval=1m&limit=60
//   Fetches OHLC data from Bybit/Kraken/OKX and renders via QuickChart.io
//
// ─── Exchange chart URLs ──────────────────────────────────────────────────────
// Update these when you have the exact chart page URLs from each exchange.

const EXCHANGE_URLS: Record<string, string> = {
  ch:     'https://grvt.io',                              // BTC/USDT 1m  — update with exact chart page
  chb:    'https://grvt.io',                              // BTC perp 1m  — update with exact chart page
  che:    'https://app.nado.xyz',                         // ETH perp 1m  — update with exact chart page
  tv_btc: 'https://www.okx.com/trade-spot/btc-usdt',     // BTC 1h
  tv_eth: 'https://www.okx.com/trade-spot/eth-usdt',     // ETH 1h (or Bitget)
};

// ─── Screenshot via screenshotone.com ─────────────────────────────────────────

async function takeScreenshot(pageUrl: string, apiKey: string): Promise<Buffer> {
  const params = new URLSearchParams({
    url:                   pageUrl,
    access_key:            apiKey,
    format:                'jpg',
    image_quality:         '85',
    viewport_width:        '1280',
    viewport_height:       '720',
    device_scale_factor:   '1',
    delay:                 '5',          // seconds to wait for chart to render
    timeout:               '40',
    block_ads:             'true',
    block_cookie_banners:  'true',
    block_trackers:        'true',
    dark_mode:             'true',
    full_page:             'false',
    cache:                 'false',
  });

  const res = await fetch(`https://api.screenshotone.com/take?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`screenshotone ${res.status}: ${txt.slice(0, 120)}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ─── OHLC fallback: Bybit → Kraken → OKX ────────────────────────────────────

interface Candle { t: number; o: number; h: number; l: number; c: number }

async function fromBybit(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const ivMap: Record<string, string> = { '1m': '1', '1h': '60', '4h': '240' };
  const iv = ivMap[interval] ?? '1';
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${iv}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
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
  const pair = pairMap[symbol] ?? 'XBTUSD';
  const iv   = ivMap[interval] ?? '1';
  const res  = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${iv}`);
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.error?.length) throw new Error(`Kraken: ${json.error[0]}`);
  const key  = Object.keys(json.result).find((k) => k !== 'last')!;
  return (json.result[key] as any[]).slice(-limit).map((k) => ({
    t: k[0] * 1000, o: parseFloat(k[1]), h: parseFloat(k[2]),
    l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

async function fromOKX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const instId  = symbol.replace('USDT', '-USDT');
  const barMap: Record<string, string> = { '1m': '1m', '1h': '1H', '4h': '4H' };
  const bar = barMap[interval] ?? '1m';
  const res = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.code !== '0' || !json.data?.length) throw new Error('OKX: no data');
  return (json.data as string[][]).reverse().map((k) => ({
    t: parseInt(k[0]), o: parseFloat(k[1]), h: parseFloat(k[2]),
    l: parseFloat(k[3]), c: parseFloat(k[4]),
  }));
}

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  for (const source of [fromBybit, fromKraken, fromOKX]) {
    try {
      const c = await source(symbol, interval, limit);
      if (c.length > 0) return c;
    } catch { /* try next */ }
  }
  throw new Error('All candle sources failed');
}

async function renderQuickChart(symbol: string, interval: string, candles: Candle[]): Promise<Buffer> {
  const chartConfig = {
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
        xAxes: [{
          ticks:     { fontColor: '#64748B', maxTicksLimit: 8, maxRotation: 0 },
          gridLines: { color: 'rgba(255,255,255,0.05)' },
        }],
        yAxes: [{
          position:  'right',
          ticks:     { fontColor: '#64748B' },
          gridLines: { color: 'rgba(255,255,255,0.05)' },
        }],
      },
      legend: { labels: { fontColor: '#94A3B8', fontSize: 12 } },
    },
  };

  const qcRes = await fetch('https://quickchart.io/chart', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart: chartConfig, width: 800, height: 450,
      backgroundColor: '#06080B', format: 'png', devicePixelRatio: 2,
    }),
  });
  if (!qcRes.ok) {
    const txt = await qcRes.text().catch(() => '');
    throw new Error(`QuickChart ${qcRes.status}: ${txt.slice(0, 120)}`);
  }
  return Buffer.from(await qcRes.arrayBuffer());
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const screenshotKey = process.env.SCREENSHOTONE_ACCESS_KEY ?? '';
  const cmd           = req.query.cmd as string | undefined;   // ch | chb | che | tv_btc | tv_eth

  // ── Mode 1: Exchange screenshot ────────────────────────────────────────────
  if (cmd && screenshotKey) {
    const pageUrl = EXCHANGE_URLS[cmd];
    if (!pageUrl) return res.status(400).json({ error: `Unknown chart command: ${cmd}` });

    try {
      const img = await takeScreenshot(pageUrl, screenshotKey);
      res.setHeader('Content-Type',  'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(img);
    } catch (err: any) {
      // Fall through to QuickChart if screenshot fails
      console.warn('[chart] screenshot failed, falling back to QuickChart:', err.message);
    }
  }

  // ── Mode 2: QuickChart candlestick (fallback or when no screenshot key) ───
  const symbol   = String(req.query.symbol   ?? 'BTCUSDT').toUpperCase();
  const interval = String(req.query.interval ?? '1m');
  const limit    = Math.min(Number(req.query.limit ?? 60), 100);

  let candles: Candle[];
  try {
    candles = await fetchCandles(symbol, interval, limit);
  } catch (err: any) {
    return res.status(502).json({ error: `Candle fetch failed: ${err.message}` });
  }

  const lastClose  = candles[candles.length - 1]?.c ?? 0;
  const firstClose = candles[0]?.c ?? lastClose;
  const pct        = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

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
