import { Settings as SettingsIcon, LogOut, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { DensityToggle } from '../../components/DensityToggle';
import { truncateAddress } from '../../services/sodex';
import { clearTradeHistory } from '../../services/tradeHistory';

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { wallet, handleDisconnectWallet, refreshTradeHistory } = useDashboard();
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function copyAddress() {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div>
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="px-5 py-3 flex items-center gap-2"
      >
        <SettingsIcon size={14} className="text-slate-500 shrink-0" />
        <span className="text-xs font-semibold text-white uppercase tracking-widest font-mono">Settings</span>
      </div>

      <div className="max-w-screen-md mx-auto w-full p-5 flex flex-col gap-4">

        <SettingsCard title="Layout Density">
          <p className="text-xs text-slate-500 mb-3">Choose how dense the dashboard layout is, or let it auto-adapt to your screen.</p>
          <DensityToggle />
        </SettingsCard>

        <SettingsCard title="Wallet">
          {wallet.connected && wallet.address ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-mono text-white">{truncateAddress(wallet.address)}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">SoDEX Testnet · chain 138565</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyAddress}
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: copied ? '#34D399' : '#94A3B8' }}
                >
                  <Copy size={12} className="shrink-0" /> {copied ? 'Copied!' : 'Copy Address'}
                </button>
                <a
                  href={`https://testnet.sodex.com/portfolio?address=${wallet.address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}
                >
                  <ExternalLink size={12} className="shrink-0" /> Explorer
                </a>
                <button
                  onClick={handleDisconnectWallet}
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171' }}
                >
                  <LogOut size={12} className="shrink-0" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Not connected</p>
          )}
        </SettingsCard>

        <SettingsCard title="Data">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Clear your locally stored trade history (does not affect on-chain data).</p>
            <button
              onClick={() => { clearTradeHistory(); refreshTradeHistory(); setCleared(true); setTimeout(() => setCleared(false), 1800); }}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 ml-3"
              style={{ background: 'rgba(248,113,113,0.1)', color: cleared ? '#34D399' : '#F87171' }}
            >
              <Trash2 size={12} className="shrink-0" /> {cleared ? 'Cleared' : 'Clear'}
            </button>
          </div>
        </SettingsCard>

        <p className="text-[10px] text-slate-700 text-center font-mono">ETFSignalAI · Testnet only · Not financial advice</p>
      </div>
    </div>
  );
}
