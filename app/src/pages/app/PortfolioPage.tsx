import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, RefreshCw, ArrowUp, ArrowDown, ExternalLink, Wallet, Zap } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { fetchBalances, fetchPerpsPositionHistory, truncateAddress } from '../../services/sodex';
import { formatUSD } from '../../services/sosovalue';
import type { PerpsPosition } from '../../types';

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  submitted: '#00FFA7',
  filled:    '#34D399',
  failed:    '#F87171',
};

const CURRENCY_STYLE: Record<string, { color: string; label: string }> = {
  BTC:  { color: '#F59E0B', label: 'Bitcoin' },
  ETH:  { color: '#818CF8', label: 'Ethereum' },
  USDC: { color: '#00FFA7', label: 'USD Coin' },
};

const PAGE_SIZE = 5;

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--brand-border)' }}>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="w-7 h-7 rounded-lg text-xs font-mono transition-colors"
          style={n === page
            ? { background: 'rgba(0,255,167,0.12)', color: '#00FFA7', border: '1px solid rgba(0,255,167,0.3)' }
            : { color: '#64748b', border: '1px solid transparent' }
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const { wallet, tradeHistory, liveBtcPx, liveEthPx, latestBtcPx, latestEthPx } = useDashboard();
  const [balances,   setBalances]   = useState<Record<string, string>>({});
  const [balLoading, setBalLoading] = useState(false);

  const loadBalances = useCallback(() => {
    if (!wallet.address) return;
    setBalLoading(true);
    fetchBalances(wallet.address)
      .then(setBalances)
      .catch(() => setBalances({}))
      .finally(() => setBalLoading(false));
  }, [wallet.address]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  const [positions,    setPositions]    = useState<PerpsPosition[]>([]);
  const [posLoading,   setPosLoading]   = useState(false);

  const loadPositions = useCallback(() => {
    if (!wallet.address) return;
    setPosLoading(true);
    fetchPerpsPositionHistory(wallet.address)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setPosLoading(false));
  }, [wallet.address]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  const btcPrice = liveBtcPx ?? latestBtcPx ?? 0;
  const ethPrice = liveEthPx ?? latestEthPx ?? 0;

  const totalUsd = useMemo(() => {
    return Object.entries(balances).reduce((sum, [currency, amount]) => {
      const n = parseFloat(amount) || 0;
      if (currency === 'BTC') return sum + n * btcPrice;
      if (currency === 'ETH') return sum + n * ethPrice;
      return sum + n; // USDC and anything else treated as ~$1
    }, 0);
  }, [balances, btcPrice, ethPrice]);

  const buys  = tradeHistory.filter(t => t.side === 'BUY').length;
  const sells = tradeHistory.filter(t => t.side === 'SELL').length;

  const [posPage, setPosPage] = useState(1);
  const posPageCount = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const safePosPage = Math.min(posPage, posPageCount);
  const pagedPositions = positions.slice((safePosPage - 1) * PAGE_SIZE, safePosPage * PAGE_SIZE);

  const [tradePage, setTradePage] = useState(1);
  const tradePageCount = Math.max(1, Math.ceil(tradeHistory.length / PAGE_SIZE));
  const safeTradePage = Math.min(tradePage, tradePageCount);
  const pagedTrades = tradeHistory.slice((safeTradePage - 1) * PAGE_SIZE, safeTradePage * PAGE_SIZE);

  return (
    <div>
      {/* Hero */}
      <div
        className="relative overflow-hidden px-5 py-6"
        style={{
          background: 'linear-gradient(135deg, rgba(0,255,167,0.07) 0%, rgba(0,255,167,0.03) 50%, rgba(0,255,167,0.05) 100%)',
          borderBottom: '1px solid rgba(0,255,167,0.08)',
        }}
      >
        <svg className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" aria-hidden>
          <defs>
            <pattern id="portfolio-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,167,0.4)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#portfolio-grid)" />
        </svg>

        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5 flex items-center gap-2" style={{ color: '#00FFA7' }}>
              <PieChart size={12} className="shrink-0" /> Portfolio
            </p>
            <div className="text-3xl font-bold font-mono text-white mb-1">
              {balLoading ? <div className="shimmer h-9 w-40 rounded" /> : formatUSD(totalUsd)}
            </div>
            {wallet.address && (
              <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                <Wallet size={11} className="shrink-0" /> {truncateAddress(wallet.address)} · SoDEX Testnet
              </p>
            )}
          </div>
          <button
            onClick={() => { loadBalances(); loadPositions(); }}
            disabled={balLoading || posLoading}
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={11} className={`shrink-0${(balLoading || posLoading) ? ' animate-spin' : ''}`} />
            {(balLoading || posLoading) ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto w-full p-5 flex flex-col gap-4">

        {/* Balances */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Wallet Balances</h3>
          {balLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
            </div>
          ) : Object.keys(balances).length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4 font-mono">No balances found on SoDEX Testnet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(balances).map(([currency, amount]) => {
                const style = CURRENCY_STYLE[currency] ?? { color: '#94A3B8', label: currency };
                return (
                  <div
                    key={currency}
                    style={{ background: `${style.color}0D`, border: `1px solid ${style.color}33` }}
                    className="rounded-xl p-3.5 flex items-center gap-3"
                  >
                    <div
                      style={{ background: `${style.color}20`, border: `1px solid ${style.color}50`, color: style.color }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    >
                      {currency.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{style.label}</div>
                      <div className="text-sm font-bold font-mono text-white truncate">
                        {parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Perps position history — liquidation status is SoDEX's own record (isTakenOver), not our estimate */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Perps Position History</h3>
          {posLoading ? (
            <div className="space-y-2">
              {Array(2).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded-lg" />)}
            </div>
          ) : positions.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4 font-mono">No perps positions yet — open one from an AI signal (Futures tab)</p>
          ) : (
            <div className="space-y-2">
              {pagedPositions.map(p => {
                const isLongPos = parseFloat(p.size) >= 0;
                const pnl = parseFloat(p.realizedPnL) || 0;
                const pnlColor = pnl >= 0 ? '#34D399' : '#F87171';
                return (
                  <div
                    key={p.id}
                    style={{ background: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${p.isTakenOver ? '#F87171' : pnlColor}` }}
                    className="flex items-center gap-3 py-2.5 px-3 text-sm rounded-lg"
                  >
                    <span style={{ color: isLongPos ? '#34D399' : '#F87171', background: `${isLongPos ? '#34D399' : '#F87171'}20`, border: `1px solid ${isLongPos ? '#34D399' : '#F87171'}40` }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                      {isLongPos ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{isLongPos ? 'LONG' : 'SHORT'} {p.symbol} · {p.leverage}x</span>
                        {p.isTakenOver ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                            <Zap size={9} className="shrink-0" /> Liquidated
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: p.active ? 'rgba(0,255,167,0.12)' : 'rgba(148,163,184,0.1)', color: p.active ? '#00FFA7' : '#94A3B8' }}>
                            {p.active ? 'Open' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        Entry ${parseFloat(p.avgEntryPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        {' → '}
                        {p.isTakenOver ? `Liquidated $${parseFloat(p.takeOverPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : (parseFloat(p.avgClosePrice) > 0 ? `$${parseFloat(p.avgClosePrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-semibold" style={{ color: pnlColor }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-600">{timeAgo(p.updatedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={safePosPage} total={positions.length} onChange={setPosPage} />
        </div>

        {/* Trade history */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trade History</h3>
            {tradeHistory.length > 0 && (
              <span className="text-[10px] text-slate-600 font-mono">
                {tradeHistory.length} trade{tradeHistory.length !== 1 ? 's' : ''} · <span style={{ color: '#34D399' }}>{buys} buy</span> · <span style={{ color: '#F87171' }}>{sells} sell</span>
              </span>
            )}
          </div>
          {tradeHistory.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4 font-mono">No trades yet — execute one from an AI signal</p>
          ) : (
            <div className="space-y-2">
              {pagedTrades.map(t => {
                const isBuy = t.side === 'BUY';
                const color = isBuy ? '#34D399' : '#F87171';
                return (
                  <div
                    key={t.id}
                    style={{ background: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${color}` }}
                    className="flex items-center gap-3 py-2.5 px-3 text-sm rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span style={{ color, background: `${color}20`, border: `1px solid ${color}40` }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                      {isBuy ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{t.side} {t.pair}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}>
                          {t.status}
                        </span>
                      </div>
                      {t.signal && <div className="text-[10px] text-slate-600 truncate">{t.signal}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs text-slate-300">{t.size} {t.currency}</div>
                      <div className="text-[10px] text-slate-600">{timeAgo(t.timestamp)}</div>
                    </div>
                    <a
                      href={`https://testnet.sodex.com/portfolio?address=${wallet.address ?? ''}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                      title="View on SoDEX"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={safeTradePage} total={tradeHistory.length} onChange={setTradePage} />
        </div>
      </div>
    </div>
  );
}
