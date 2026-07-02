/**
 * TradingChart — real TradingView-style candlestick chart
 * - Live OHLC data from Binance public API (no key needed)
 * - lightweight-charts v5 (same library as SoDEX)
 * - Candlesticks + MA7 + MA9 + Volume bars
 */
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KlineBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingChartProps {
  symbol: 'BTCUSDT' | 'ETHUSDT';
  asset: 'BTC' | 'ETH';
  interval?: '1d' | '4h' | '1h' | '15m';
  limit?: number;
  currentPrice?: number | null;
}

// ─── Kline cache (avoids re-fetching on BTC↔ETH tab switch) ──────────────────

const klineCache = new Map<string, { bars: KlineBar[]; ts: number }>();
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

// ─── Binance KLINES (public, no auth, browser CORS allowed) ──────────────────

async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<KlineBar[]> {
  const cacheKey = `${symbol}-${interval}-${limit}`;
  const cached   = klineCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.bars;

  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Binance API ${res.status}: ${res.statusText}`);

  // Each element: [openTime, open, high, low, close, volume, ...]
  const raw: [number, string, string, string, string, string, ...unknown[]][] =
    await res.json();

  const bars = raw.map(k => ({
    time:   Math.floor(k[0] / 1000) as UTCTimestamp,
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
  klineCache.set(cacheKey, { bars, ts: Date.now() });
  return bars;
}

// ─── MA calculation ───────────────────────────────────────────────────────────

function calcMA(
  bars: KlineBar[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const sum = bars
      .slice(i - period + 1, i + 1)
      .reduce((s, b) => s + b.close, 0);
    out.push({ time: bars[i].time, value: parseFloat((sum / period).toFixed(2)) });
  }
  return out;
}

// ─── Chart theme matching the app ────────────────────────────────────────────

const CHART_OPTIONS = {
  layout: {
    background:  { type: ColorType.Solid, color: 'transparent' },
    textColor:   '#64748B',
    fontSize:    10,
    fontFamily:  'JetBrains Mono, ui-monospace, monospace',
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.03)' },
    horzLines: { color: 'rgba(255,255,255,0.05)' },
  },
  crosshair: {
    vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1E293B' },
    horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1E293B' },
  },
  rightPriceScale: {
    borderColor:   'rgba(255,255,255,0.06)',
    textColor:     '#64748B',
    scaleMargins:  { top: 0.08, bottom: 0.22 }, // leave room for volume at bottom
  },
  timeScale: {
    borderColor:      'rgba(255,255,255,0.06)',
    textColor:        '#64748B',
    timeVisible:      true,
    secondsVisible:   false,
    fixLeftEdge:      true,
    fixRightEdge:     true,
  },
  handleScroll:  { mouseWheel: true, pressedMouseMove: true },
  handleScale:   { mouseWheel: true, pinch: true },
} as const;

const CANDLE_OPTS = {
  upColor:        '#26a69a',
  downColor:      '#ef5350',
  borderVisible:  true,
  borderUpColor:  '#26a69a',
  borderDownColor:'#ef5350',
  wickUpColor:    '#26a69a',
  wickDownColor:  '#ef5350',
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

export function TradingChart({
  symbol,
  asset,
  interval = '1d',
  limit = 60,
  currentPrice,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [stats,      setStats]      = useState<{
    latest: number;
    change: number;
    changePct: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    // Destroy any previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    setLoading(true);
    setError(null);

    fetchKlines(symbol, interval, limit)
      .then(bars => {
        if (cancelled || !el) return;

        // ── Create chart ──────────────────────────────────────────────────
        const chart = createChart(el, {
          ...CHART_OPTIONS,
          autoSize: true,
        });
        chartRef.current = chart;

        // ── Candlestick series ────────────────────────────────────────────
        const candles = chart.addSeries(CandlestickSeries, CANDLE_OPTS);
        candles.setData(
          bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
        );

        // ── MA7 ───────────────────────────────────────────────────────────
        const ma7 = chart.addSeries(LineSeries, {
          color:                '#F59E0B',
          lineWidth:            1,
          crosshairMarkerVisible: false,
          lastValueVisible:     false,
          priceLineVisible:     false,
        });
        ma7.setData(calcMA(bars, 7));

        // ── MA9 ───────────────────────────────────────────────────────────
        const ma9 = chart.addSeries(LineSeries, {
          color:                '#60A5FA',
          lineWidth:            1,
          crosshairMarkerVisible: false,
          lastValueVisible:     false,
          priceLineVisible:     false,
        });
        ma9.setData(calcMA(bars, 9));

        // ── Volume histogram (bottom 20 %) ────────────────────────────────
        const vol = chart.addSeries(HistogramSeries, {
          priceFormat:  { type: 'volume' },
          priceScaleId: '',           // overlay on same pane
        });
        vol.priceScale().applyOptions({
          scaleMargins: { top: 0.78, bottom: 0 },
        });
        vol.setData(
          bars.map(b => ({
            time:  b.time,
            value: b.volume,
            color: b.close >= b.open
              ? 'rgba(38,166,154,0.55)'
              : 'rgba(239,83,80,0.55)',
          }))
        );

        // ── Fit & stats ───────────────────────────────────────────────────
        chart.timeScale().fitContent();

        const first  = bars[0].close;
        const latest = bars[bars.length - 1].close;
        const change = latest - first;
        setStats({ latest, change, changePct: (change / first) * 100 });
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Chart load failed');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  // Re-create the chart when symbol, interval, limit, or retryCount changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, limit, retryCount]);

  // ── Derive display price: live WebSocket > latest candle close ────────────
  const displayPrice = currentPrice ?? stats?.latest;
  const change       = stats?.change    ?? 0;
  const changePct    = stats?.changePct ?? 0;

  const LABEL_MAP: Record<string, string> = {
    '1d': 'Daily', '4h': '4H', '1h': '1H', '15m': '15m',
  };

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              {asset}/USDT
            </span>
            <span
              style={{ background: 'rgba(0,255,167,0.1)', color: '#00FFA7', border: '1px solid rgba(0,255,167,0.22)' }}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono"
            >
              {LABEL_MAP[interval] ?? interval}
            </span>
            <span
              style={{ color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              LIVE
            </span>
          </div>

          {displayPrice != null ? (
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono font-bold text-white text-xl">
                ${displayPrice.toLocaleString(undefined, { maximumFractionDigits: displayPrice >= 1000 ? 0 : 2 })}
              </span>
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: change >= 0 ? '#26a69a' : '#ef5350' }}
              >
                {change >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
              </span>
            </div>
          ) : (
            !loading && <div className="shimmer h-6 w-28 mt-1 rounded" />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-3 text-[9px] font-mono items-center">
            <span className="flex items-center gap-1">
              <span style={{ display:'inline-block', width:14, height:2, background:'#F59E0B', borderRadius:1 }} />
              MA7
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display:'inline-block', width:14, height:2, background:'#60A5FA', borderRadius:1 }} />
              MA9
            </span>
          </div>
          <span className="text-[9px] text-slate-600 font-mono">Binance · {limit} candles</span>
        </div>
      </div>

      {/* ── Chart container ─────────────────────────────────────────────── */}
      {loading && (
        <div className="shimmer rounded-lg" style={{ height: 300 }} />
      )}

      {error && !loading && (
        <div
          style={{ height: 300, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}
          className="rounded-lg flex flex-col items-center justify-center gap-3"
        >
          <span className="text-red-400 text-sm">⚠ {error}</span>
          <button
            onClick={() => {
              klineCache.delete(`${symbol}-${interval}-${limit}`);
              setError(null);
              setLoading(true);
              setRetryCount(c => c + 1);
            }}
            className="text-xs font-mono text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            ↻ Retry
          </button>
        </div>
      )}

      {/* Always keep div in DOM so chart can mount into it */}
      <div
        ref={containerRef}
        style={{
          height: 300,
          display: loading || error ? 'none' : 'block',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      />

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="flex items-center justify-between mt-2 text-[9px] text-slate-600 font-mono">
          <span>Data: Binance · Powered by TradingView Lightweight Charts</span>
          <span>Scroll/pinch to zoom</span>
        </div>
      )}
    </div>
  );
}
