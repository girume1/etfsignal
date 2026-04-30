import { ReactNode } from 'react';

interface WalletGateProps {
  connected: boolean;
  onConnect: () => void;
  children: ReactNode;
}

export function WalletGate({ connected, onConnect, children }: WalletGateProps) {
  if (connected) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
      <div className="flex flex-col items-center text-center max-w-md w-full">

        {/* Lock icon ring */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1.5px solid rgba(99,102,241,0.35)',
            boxShadow: '0 0 40px rgba(99,102,241,0.15)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Connect Your Wallet
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Connect your wallet to access the ETFSignal AI dashboard —
          live ETF flows, AI signals, and SoDEX testnet trading.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            '📊 Live ETF Flows',
            '🤖 AI Signals',
            '⚡ SoDEX Trading',
            '📰 News Feed',
          ].map(f => (
            <span
              key={f}
              className="text-xs px-3 py-1.5 rounded-full font-medium text-slate-300"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Connect button */}
        <button
          onClick={onConnect}
          className="w-full max-w-xs py-3.5 px-6 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
          }}
        >
          Connect Wallet to Continue
        </button>

        <p className="text-xs text-slate-600 mt-4">
          MetaMask · WalletConnect · Coinbase Wallet + 300 more
        </p>
      </div>
    </div>
  );
}
