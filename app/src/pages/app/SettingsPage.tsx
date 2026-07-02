import { Settings as SettingsIcon, LogOut, Copy, ExternalLink, Trash2, Camera } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { DensityToggle } from '../../components/DensityToggle';
import { truncateAddress } from '../../services/sodex';
import { clearTradeHistory } from '../../services/tradeHistory';
import { setProfile, resizeImageToDataUrl } from '../../services/profile';

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
  const { wallet, handleDisconnectWallet, refreshTradeHistory, profile, refreshProfile } = useDashboard();
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [name, setName] = useState(profile.name);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local field when the underlying profile changes (e.g. wallet switch)
  useEffect(() => setName(profile.name), [profile.name]);

  async function copyAddress() {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !wallet.address) return;
    try {
      const avatar = await resizeImageToDataUrl(file);
      setProfile(wallet.address, { name, avatar });
      refreshProfile();
      setAvatarError(null);
    } catch {
      setAvatarError('Could not load that image');
    }
  }

  function saveName() {
    if (!wallet.address) return;
    setProfile(wallet.address, { name, avatar: profile.avatar });
    refreshProfile();
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1500);
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

        <SettingsCard title="Profile">
          {wallet.connected && wallet.address ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Change profile picture"
                className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden group"
                style={{ border: '1px solid var(--brand-border)' }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FF7637, #E86530)' }}
                  >
                    {(profile.name || wallet.address).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={16} className="text-white" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />

              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Display Name</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    placeholder={truncateAddress(wallet.address)}
                    maxLength={24}
                    style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors min-w-0"
                  />
                  <button
                    onClick={saveName}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0"
                    style={{ background: 'rgba(0,255,167,0.12)', color: nameSaved ? '#34D399' : '#00FFA7' }}
                  >
                    {nameSaved ? 'Saved!' : 'Save'}
                  </button>
                </div>
                {avatarError && <p className="text-[10px] text-red-400 mt-1">{avatarError}</p>}
                <p className="text-[10px] text-slate-600 mt-1">Shown only in this browser — not published anywhere.</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">Connect a wallet to set a profile picture and display name.</p>
          )}
        </SettingsCard>

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
