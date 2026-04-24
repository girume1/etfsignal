import { useRef, useState, useEffect } from 'react';
import type { EtfData } from '../types';
import { formatUSD } from '../services/sosovalue';

interface TickerStripProps {
  btcData: EtfData | null;
  ethData: EtfData | null;
  btcPrice?: number;
  ethPrice?: number;
  /** True when the Binance WebSocket is connected and prices are live */
  liveConnected?: boolean;
}

/**
 * Bloomberg-style scrolling ticker.
 * When liveConnected=true, BTC/ETH prices update in real-time from Binance WS
 * and a green "LIVE" pill is shown on the right edge.
 *
 * Hover pauses the scroll (accessibility).
 */
export function TickerStrip({
  btcData, ethData, btcPrice, ethPrice, liveConnected = false,
}: TickerStripProps) {
  // Flash animation for price updates
  const [btcFlash, setBtcFlash] = useState(false);
  const [ethFlash, setEthFlash] = useState(false);
  const prevBtc = useRef<number | undefined>(btcPrice);
  const prevEth = useRef<number | undefined>(ethPrice);

  useEffect(() => {
    if (btcPrice !== undefined && btcPrice !== prevBtc.current && liveConnected) {
      setBtcFlash(true);
      const t = setTimeout(() => setBtcFlash(false), 300);
      prevBtc.current = btcPrice;
      return () => clearTimeout(t);
    }
    prevBtc.current = btcPrice;
  }, [btcPrice, liveConnected]);

  useEffect(() => {
    if (ethPrice !== undefined && ethPrice !== prevEth.current && liveConnected) {
      setEthFlash(true);
      const t = setTimeout(() => setEthFlash(false), 300);
      prevEth.current = ethPrice;
      return () => clearTimeout(t);
    }
    prevEth.current = ethPrice;
  }, [ethPrice, liveConnected]);

  const items: { label: string; value: string; color: string; flash?: boolean }[] = [];

  if (btcPrice) items.push({
    label: 'BTC',
    value: `$${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    color: '#FCD34D',
    flash: btcFlash,
  });
  if (ethPrice) items.push({
    label: 'ETH',
    value: `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    color: '#A78BFA',
    flash: ethFlash,
  });

  if (btcData) {
    items.push({
      label: 'BTC ETF AUM',
      value: formatUSD(btcData.totalNetAssets.value).replace('+', ''),
      color: '#60A5FA',
    });
    items.push({
      label: 'BTC Flow',
      value: formatUSD(btcData.dailyNetInflow.value),
      color: (btcData.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
    });
    btcData.list.slice(0, 4).forEach(f => {
      if (f.dailyNetInflow.value === null) return;
      items.push({
        label: f.ticker,
        value: formatUSD(f.dailyNetInflow.value),
        color: (f.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
      });
    });
  }
  if (ethData) {
    items.push({
      label: 'ETH ETF AUM',
      value: formatUSD(ethData.totalNetAssets.value).replace('+', ''),
      color: '#60A5FA',
    });
    items.push({
      label: 'ETH Flow',
      value: formatUSD(ethData.dailyNetInflow.value),
      color: (ethData.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
    });
    ethData.list.slice(0, 3).forEach(f => {
      if (f.dailyNetInflow.value === null) return;
      items.push({
        label: f.ticker,
        value: formatUSD(f.dailyNetInflow.value),
        color: (f.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
      });
    });
  }

  if (items.length === 0) {
    return (
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="h-10 flex items-center px-6"
      >
        <div className="shimmer h-3 w-full rounded" />
      </div>
    );
  }

  // Duplicate the track so the scroll loops seamlessly.
  const track = [...items, ...items];

  return (
    <div
      style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
      className="h-10 flex items-center overflow-hidden relative group"
    >
      <div className="flex gap-8 whitespace-nowrap ticker-scroll group-hover:[animation-play-state:paused]">
        {track.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs shrink-0">
            <span className="text-slate-500 uppercase tracking-wider font-mono">{item.label}</span>
            <span
              className="font-mono font-semibold transition-colors duration-150"
              style={{ color: item.flash ? '#fff' : item.color }}
            >
              {item.value}
            </span>
            <span className="text-slate-700 font-mono">·</span>
          </div>
        ))}
      </div>

      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none"
        style={{ background: 'linear-gradient(to right, var(--brand-panel), transparent)' }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none"
        style={{ background: 'linear-gradient(to left, var(--brand-panel), transparent)' }}
      />

      {/* LIVE indicator */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 z-10">
        <span
          className="text-[9px] font-mono font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{
            background: liveConnected
              ? 'rgba(52,211,153,0.12)'
              : 'rgba(100,116,139,0.12)',
            color: liveConnected ? '#34D399' : '#475569',
            border: `1px solid ${liveConnected ? 'rgba(52,211,153,0.3)' : 'rgba(100,116,139,0.2)'}`,
          }}
        >
          <span
            className={liveConnected ? 'animate-pulse' : ''}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: liveConnected ? '#34D399' : '#475569',
              display: 'inline-block',
            }}
          />
          {liveConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>
    </div>
  );
}
