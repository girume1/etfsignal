import { Moon } from 'lucide-react';
import type { WalletState } from '../types';
import { WalletMenu } from './WalletMenu';
import { useDashboard } from '../contexts/DashboardContext';
import { formatUSD } from '../services/sosovalue';

interface HeaderProps {
  wallet: WalletState;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  lastUpdated: Date | null;
  onToggleSidebar?: () => void;
}

function PricePill({
  icon, label, price, change, color,
}: {
  icon: string; label: string; price: string; change?: string; color: string;
}) {
  const isPos = !change || change.startsWith('+');
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:bg-white/5"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="text-slate-400 font-semibold">{label}</span>
      <span className="text-white font-bold">{price}</span>
      {change && (
        <span
          className="font-semibold text-[10px]"
          style={{ color: isPos ? '#34D399' : '#F87171' }}
        >
          {change}
        </span>
      )}
    </div>
  );
}

export function Header({
  wallet, onConnectWallet, onDisconnectWallet, onToggleSidebar,
}: HeaderProps) {
  const {
    btcData, ethData,
    liveBtcPx, liveEthPx, latestBtcPx, latestEthPx,
    liveConnected,
  } = useDashboard();

  const btcPrice = liveBtcPx ?? latestBtcPx;
  const ethPrice = liveEthPx ?? latestEthPx;

  // Total ETF AUM = BTC AUM + ETH AUM
  const btcAum  = btcData?.totalNetAssets?.value as number | null ?? null;
  const ethAum  = ethData?.totalNetAssets?.value as number | null ?? null;
  const totalAum = btcAum !== null && ethAum !== null ? btcAum + ethAum : btcAum ?? ethAum;

  // AUM 24h change %
  const aumChangePct = btcData?.totalNetAssetsPercentage?.value as number | null ?? null;
  const aumChangeStr = aumChangePct !== null
    ? `${aumChangePct >= 0 ? '+' : ''}${(aumChangePct * 100).toFixed(2)}%`
    : undefined;

  return (
    <header
      className="flex items-center justify-between px-4 gap-3 sticky top-0 z-50 h-14"
      style={{
        background: 'rgba(6,8,11,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Mobile hamburger */}
      <div className="flex items-center gap-2 lg:hidden shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xl leading-none font-light">≡</span>
          </button>
        )}
        {/* Mobile logo */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 lg:hidden"
          style={{ background: '#FF7637' }}
        >
          E
        </div>
      </div>

      {/* Price tickers — center row */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {btcPrice && (
          <PricePill
            icon="🟡"
            label="BTC"
            price={`$${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            color="#F59E0B"
          />
        )}
        {ethPrice && (
          <PricePill
            icon="🔵"
            label="ETH"
            price={`$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            color="#818CF8"
          />
        )}
        {totalAum !== null && (
          <PricePill
            icon="📊"
            label="TOTAL ETF AUM"
            price={formatUSD(totalAum).replace('+', '')}
            change={aumChangeStr}
            color="#FF7637"
          />
        )}

        {/* Live dot */}
        {liveConnected && (
          <div className="hidden md:flex items-center gap-1.5 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400">LIVE</span>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          title="Toggle theme"
        >
          <Moon size={14} />
        </button>

        <WalletMenu
          wallet={wallet}
          onConnect={onConnectWallet}
          onDisconnect={onDisconnectWallet}
        />
      </div>
    </header>
  );
}
