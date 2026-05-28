// Vercel Node.js Serverless Function — Candlestick chart generator
// Fetches Binance klines and renders them via QuickChart.io (free, no key needed).
// Called internally by the Telegram bot to produce chart images.
//
// Query params:
//   symbol   — Binance symbol, e.g. BTCUSDT, ETHUSDT (default: BTCUSDT)
//   interval — Binance kline interval: 1m, 5m, 15m, 1h, 4h, 1d (default: 1m)
//   limit    — Number of candles (default: 60, max: 100)

const QUICKCHART = 'https://quickchart.io/chart';
const BINANCE    = 'https://api.binance.com/api/v3/klines';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol   = String(req.query.symbol   ?? 'BTCUSDT').toUpperCase();
  const interval = String(req.query.interval ?? '1m');
  const limit    = Math.min(Number(req.query.limit ?? 60), 100);

  // ── 1. Fetch Binance klines ──────────────────────────────────────────────
  let klines: any[];
  try {
    const kRes = await fetch(`${BINANCE}?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!kRes.ok) throw new Error(`Binance ${kRes.status}`);
    klines = await kRes.json();
  } catch (err: any) {
    return res.status(502).json({ error: `Binance fetch failed: ${err.message}` });
  }

  // Each kline: [openTime, open, high, low, close, volume, ...]
  // QuickChart uses Chart.js 2 + chartjs-chart-financial — time key must be `t`, not `x`
  const candles = klines.map((k: any) => ({
    t: k[0],                // open time (ms) — Chart.js 2 uses `t` for time axis
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
  }));

  const lastClose  = candles[candles.length - 1]?.c ?? 0;
  const firstClose = candles[0]?.c ?? lastClose;
  const pct        = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const trending   = pct >= 0;

  // ── 2. Build QuickChart config ───────────────────────────────────────────
  const chartConfig = {
    type: 'candlestick',
    data: {
      datasets: [
        {
          label: `${symbol} (${interval})`,
          data: candles,
          color: {
            up:        'rgba(52,211,153,0.9)',   // teal — bullish
            down:      'rgba(248,113,113,0.9)',   // red  — bearish
            unchanged: 'rgba(148,163,184,0.6)',   // slate
          },
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: { color: '#94A3B8', font: { size: 12 } },
        },
        annotation: {},
      },
      scales: {
        x: {
          ticks: { color: '#64748B', maxTicksLimit: 8, maxRotation: 0 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          position: 'right',
          ticks:    { color: '#64748B' },
          grid:     { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  };

  // ── 3. Call QuickChart.io ────────────────────────────────────────────────
  let imgBuffer: ArrayBuffer;
  try {
    const qcRes = await fetch(QUICKCHART, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart:           chartConfig,
        width:           800,
        height:          450,
        backgroundColor: '#06080B',   // matches --brand-dark
        format:          'png',
        devicePixelRatio: 2,
      }),
    });
    if (!qcRes.ok) throw new Error(`QuickChart ${qcRes.status}`);
    imgBuffer = await qcRes.arrayBuffer();
  } catch (err: any) {
    return res.status(502).json({ error: `Chart render failed: ${err.message}` });
  }

  // ── 4. Return image ──────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  res.setHeader('X-Symbol',   symbol);
  res.setHeader('X-Interval', interval);
  res.setHeader('X-Pct',      pct.toFixed(2));
  res.setHeader('X-Trending', trending ? '1' : '0');
  return res.send(Buffer.from(imgBuffer));
}
