// Vercel Node.js Serverless Function — Candlestick chart generator
// Binance blocks Vercel/AWS IPs, so we try Bybit → Kraken → OKX as fallbacks.
// Renders via QuickChart.io (free, no API key needed).
//
// Query params:
//   symbol   — base symbol: BTCUSDT or ETHUSDT (default: BTCUSDT)
//   interval — 1m | 1h | 4h (default: 1m)
//   limit    — candle count (default: 60, max: 100)

const QUICKCHART = 'https://quickchart.io/chart';

interface Candle { t: number; o: number; h: number; l: number; c: number }

// ── Exchange adapters ─────────────────────────────────────────────────────────

async function fromBybit(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  // Bybit interval: '1' = 1m, '60' = 1h, '240' = 4h
  const intervalMap: Record<string, string> = { '1m': '1', '1h': '60', '4h': '240' };
  const iv = intervalMap[interval] ?? '1';

  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${iv}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);

  const json: any = await res.json();
  if (json.retCode !== 0 || !json.result?.list?.length) throw new Error('Bybit: no data');

  // Bybit returns newest→oldest — reverse to chronological
  return (json.result.list as string[][]).reverse().map((k) => ({
    t: parseInt(k[0]),
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
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
  const rows = (json.result[key] as any[]).slice(-limit);

  return rows.map((k) => ({
    t: k[0] * 1000,          // Kraken uses seconds → convert to ms
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
  }));
}

async function fromOKX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  // OKX instId: BTC-USDT, ETH-USDT
  const instId  = symbol.replace('USDT', '-USDT');
  const barMap: Record<string, string> = { '1m': '1m', '1h': '1H', '4h': '4H' };
  const bar = barMap[interval] ?? '1m';

  const res = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);

  const json: any = await res.json();
  if (json.code !== '0' || !json.data?.length) throw new Error('OKX: no data');

  // OKX returns newest first: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  return (json.data as string[][]).reverse().map((k) => ({
    t: parseInt(k[0]),
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
  }));
}

// ── Try sources in order ──────────────────────────────────────────────────────

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const sources = [
    () => fromBybit(symbol, interval, limit),
    () => fromKraken(symbol, interval, limit),
    () => fromOKX(symbol, interval, limit),
  ];

  let lastErr = 'All sources failed';
  for (const source of sources) {
    try {
      const candles = await source();
      if (candles.length > 0) return candles;
    } catch (e: any) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol   = String(req.query.symbol   ?? 'BTCUSDT').toUpperCase();
  const interval = String(req.query.interval ?? '1m');
  const limit    = Math.min(Number(req.query.limit ?? 60), 100);

  // ── 1. Fetch candles ───────────────────────────────────────────────────────
  let candles: Candle[];
  try {
    candles = await fetchCandles(symbol, interval, limit);
  } catch (err: any) {
    return res.status(502).json({ error: `Candle fetch failed: ${err.message}` });
  }

  const lastClose  = candles[candles.length - 1]?.c ?? 0;
  const firstClose = candles[0]?.c ?? lastClose;
  const pct        = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  // ── 2. Build QuickChart config (Chart.js 2 + chartjs-chart-financial) ──────
  // Chart.js 2 financial charts use `t` (not `x`) for the time key.
  const chartConfig = {
    type: 'candlestick',
    data: {
      datasets: [{
        label: `${symbol} (${interval})`,
        data:  candles,
        color: {
          up:        'rgba(52,211,153,0.9)',   // teal — bullish
          down:      'rgba(248,113,113,0.9)',   // red  — bearish
          unchanged: 'rgba(148,163,184,0.6)',
        },
      }],
    },
    options: {
      scales: {
        xAxes: [{
          ticks: { fontColor: '#64748B', maxTicksLimit: 8, maxRotation: 0 },
          gridLines: { color: 'rgba(255,255,255,0.05)' },
        }],
        yAxes: [{
          position: 'right',
          ticks:     { fontColor: '#64748B' },
          gridLines: { color: 'rgba(255,255,255,0.05)' },
        }],
      },
      legend: { labels: { fontColor: '#94A3B8', fontSize: 12 } },
    },
  };

  // ── 3. Render via QuickChart ───────────────────────────────────────────────
  let imgBuffer: ArrayBuffer;
  try {
    const qcRes = await fetch(QUICKCHART, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart:            chartConfig,
        width:            800,
        height:           450,
        backgroundColor:  '#06080B',
        format:           'png',
        devicePixelRatio: 2,
      }),
    });
    if (!qcRes.ok) {
      const txt = await qcRes.text().catch(() => '');
      throw new Error(`QuickChart ${qcRes.status}: ${txt.slice(0, 120)}`);
    }
    imgBuffer = await qcRes.arrayBuffer();
  } catch (err: any) {
    return res.status(502).json({ error: `Chart render failed: ${err.message}` });
  }

  // ── 4. Return image ────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  res.setHeader('X-Pct',         pct.toFixed(2));
  res.setHeader('X-Trending',    pct >= 0 ? '1' : '0');
  return res.send(Buffer.from(imgBuffer));
}
