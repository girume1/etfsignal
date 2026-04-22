import type { WalletState } from '../types';
import { DensityToggle } from './DensityToggle';
import { WalletMenu } from './WalletMenu';
import { useDensity } from '../contexts/DensityContext';

interface HeaderProps {
  wallet: WalletState;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  lastUpdated: Date | null;
  demoMode?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({
  wallet, onConnectWallet, onDisconnectWallet,
  lastUpdated, demoMode = false, onToggleSidebar,
}: HeaderProps) {
  const { isMobile } = useDensity();

  return (
    <header
      style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
      className="px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-50"
    >
      {/* Logo + hamburger */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            style={{ border: '1px solid var(--brand-border)' }}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg leading-none">≡</span>
          </button>
        )}
        <div
          style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
        >
          E
        </div>
        <div className="min-w-0">
          <span className="font-display text-white text-lg tracking-tight">ETFSignal</span>
          <span style={{ color: 'var(--brand-accent)' }} className="font-display text-lg"> AI</span>
        </div>
        <span
          style={{ background: 'rgba(0,87,255,0.15)', color: 'var(--brand-accent)', border: '1px solid rgba(0,194,255,0.3)' }}
          className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-mono"
        >
          TESTNET
        </span>
        {demoMode && (
          <span
            style={{ background: 'rgba(251,191,36,0.12)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.3)' }}
            className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-mono uppercase tracking-wider"
            title="SoSoValue API key pending — using representative demo data"
          >
            Demo Data
          </span>
        )}
      </div>

      {/* Center — live indicator */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
        <span className="pulse-dot w-2 h-2 rounded-full bg-green-400 inline-block" />
        <span>Live</span>
        {lastUpdated && (
          <span className="text-slate-500">
            · {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        <DensityToggle compact={isMobile} />
        <WalletMenu
          wallet={wallet}
          onConnect={onConnectWallet}
          onDisconnect={onDisconnectWallet}
        />
      </div>
    </header>
  );
}
