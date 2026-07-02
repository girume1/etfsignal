import { useState, useEffect, useCallback } from 'react';
import { PieChart, RefreshCw, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { fetchBalances, truncateAddress } from '../../services/sodex';

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

export default function PortfolioPage() {
  const { wallet, tradeHistory } = useDashboard();
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

  return (
    <div>
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="px-5 py-3 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <PieChart size={14} className="text-slate-500 shrink-0" />
          <span className="text-xs font-semibold text-white uppercase tracking-widest font-mono">Portfolio</span>
          {wallet.address && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">
              {truncateAddress(wallet.address)} · SoDEX Testnet
            </span>
          )}
        </div>
        <button
          onClick={loadBalances}
          disabled={balLoading}
          style={{ border: '1px solid var(--brand-border)', color: '#64748B' }}
          className="px-2.5 py-1 rounded-lg text-[10px] font-mono hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <RefreshCw size={10} className={`shrink-0${balLoading ? ' animate-spin' : ''}`} />
          {balLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="max-w-screen-2xl mx-auto w-full p-5 flex flex-col gap-4">

        {/* Balances */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Wallet Balances</h3>
          {balLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded" />)}
            </div>
          ) : Object.keys(balances).length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4 font-mono">No balances found on SoDEX Testnet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(balances).map(([currency, amount]) => (
                <div key={currency} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }} className="rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-0.5">{currency}</div>
                  <div className="text-sm font-bold font-mono text-white">{parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade history */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trade History</h3>
          {tradeHistory.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4 font-mono">No trades yet — execute one from an AI signal</p>
          ) : (
            <div className="space-y-2">
              {tradeHistory.map(t => {
                const isBuy = t.side === 'BUY';
                const color = isBuy ? '#34D399' : '#F87171';
                return (
                  <div key={t.id} style={{ borderBottom: '1px solid var(--brand-border)' }} className="flex items-center gap-3 py-2 text-sm">
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
        </div>
      </div>
    </div>
  );
}
