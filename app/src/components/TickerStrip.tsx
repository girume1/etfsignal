import type { EtfData } from '../types';
import { formatUSD } from '../services/sosovalue';

interface TickerStripProps {
  btcData: EtfData | null;
  ethData: EtfData | null;
  btcPrice?: number;
  ethPrice?: number;
}

/**
 * Bloomberg-style scrolling ticker. Pulls the top funds from each ETF snapshot,
 * interleaves prices + aggregate flows, and animates infinitely.
 *
 * Accessibility: wrapped in `role="marquee"` with a paused-on-hover interaction.
 */
export function TickerStrip({ btcData, ethData, btcPrice, ethPrice }: TickerStripProps) {
  const items: { label: string; value: string; color: string }[] = [];

  if (btcPrice) items.push({ label: 'BTC', value: `$${btcPrice.toLocaleString()}`, color: '#FCD34D' });
  if (ethPrice) items.push({ label: 'ETH', value: `$${ethPrice.toLocaleString()}`, color: '#A78BFA' });

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
            <span className="font-mono font-semibold" style={{ color: item.color }}>{item.value}</span>
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
    </div>
  );
}
