import { useState, useRef, useEffect } from 'react';
import type { WalletState } from '../types';
import { truncateAddress } from '../services/sodex';

const EXPLORER = 'https://testnet-explorer.sodex.dev/address/';

interface WalletMenuProps {
  wallet: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletMenu({ wallet, onConnect, onDisconnect }: WalletMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!wallet.connected || !wallet.address) {
    return (
      <button
        onClick={onConnect}
        style={{ background: 'var(--brand-blue)', color: 'white' }}
        className="px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all hover:opacity-90 whitespace-nowrap"
      >
        Connect Wallet
      </button>
    );
  }

  async function copyAddress() {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open
            ? 'rgba(0,87,255,0.25)'
            : 'rgba(0,87,255,0.15)',
          border: '1px solid rgba(0,87,255,0.4)',
          color: '#93C5FD',
        }}
        className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all hover:opacity-90 flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        <span className="hidden sm:inline">{truncateAddress(wallet.address)}</span>
        <span className="sm:hidden">Wallet</span>
        <span className="text-slate-400 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            background: 'var(--brand-card)',
            border: '1px solid var(--brand-border)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          }}
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50"
        >
          {/* Address block */}
          <div
            style={{ background: 'rgba(0,87,255,0.08)', borderBottom: '1px solid var(--brand-border)' }}
            className="px-4 py-4"
          >
            <div className="flex items-center gap-3 mb-3">
              {/* Jazzicon-style avatar */}
              <div
                style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF, #A78BFA)' }}
                className="w-10 h-10 rounded-full shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs text-slate-400 mb-0.5">Connected</div>
                <div className="text-sm font-mono text-white truncate">{wallet.address}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Network badge */}
              <span
                style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}
                className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider"
              >
                ● SoDEX Testnet
              </span>
              <span
                style={{ color: '#64748B' }}
                className="text-[10px] font-mono"
              >
                chain 138565
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-2">
            <MenuAction
              icon="⧉"
              label={copied ? 'Copied!' : 'Copy Address'}
              onClick={copyAddress}
              highlight={copied}
            />
            <a
              href={`${EXPLORER}${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
            >
              <span
                style={{ background: 'rgba(0,194,255,0.1)', color: 'var(--brand-accent)' }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-mono shrink-0"
              >
                ↗
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">View on Explorer</div>
                <div className="text-[10px] text-slate-500 truncate">testnet-explorer.sodex.dev</div>
              </div>
            </a>
            <div style={{ borderTop: '1px solid var(--brand-border)' }} className="mt-1 pt-1">
              <MenuAction
                icon="⬡"
                label="Disconnect"
                onClick={() => { setOpen(false); onDisconnect(); }}
                danger
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuAction({
  icon, label, onClick, danger = false, highlight = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
    >
      <span
        style={{
          background: danger
            ? 'rgba(248,113,113,0.1)'
            : highlight
            ? 'rgba(52,211,153,0.1)'
            : 'rgba(255,255,255,0.05)',
          color: danger ? '#F87171' : highlight ? '#34D399' : '#94A3B8',
        }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-mono shrink-0"
      >
        {icon}
      </span>
      <span
        className="text-sm"
        style={{ color: danger ? '#F87171' : highlight ? '#34D399' : '#E2E8F0' }}
      >
        {label}
      </span>
    </button>
  );
}
