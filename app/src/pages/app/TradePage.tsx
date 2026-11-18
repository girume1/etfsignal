import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDashboard } from '../../contexts/dashboardStore';
import { getBuilderConfig } from '../../services/sodex';
import { ACTIVE_VALUECHAIN, USE_TESTNET, getChainDisplayName } from '../../config/valuechain';
import { ArrowLeftRight, Zap, TrendingUp, TrendingDown, Sparkles, Droplets, ClockIcon, Send, Copy, Check } from 'lucide-react';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TelegramLinkCard({ walletAddress }: { walletAddress: string }) {
  const [code,     setCode]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [linked,   setLinked]   = useState<boolean | null>(null);
  const [linkErr,  setLinkErr]  = useState<string | null>(null);

  const checkLinkStatus = useCallback(() => {
    fetch(`/api/telegram-link?wallet=${encodeURIComponent(walletAddress)}`)
      .then(r => r.json())
      .then((d: { linked?: boolean }) => {
        if (d.linked) {
          setLinked(true);
          setCode(null);
        } else {
          setLinked(false);
        }
      })
      .catch(() => setLinked(false));
  }, [walletAddress]);

  // Check link status on mount and when wallet changes
  useEffect(() => {
    checkLinkStatus();
  }, [checkLinkStatus]);

  // Poll link status while a generated code is active so UI updates immediately once linked in Telegram
  useEffect(() => {
    if (!code || linked) return;
    const interval = setInterval(checkLinkStatus, 4000);
    const onFocus = () => checkLinkStatus();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [code, linked, checkLinkStatus]);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setLinkErr(null);
    try {
      const res = await fetch('/api/telegram-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (res.ok && data.code) {
        setCode(data.code);
      } else {
        setLinkErr(data.error || 'Could not generate code. Please try again.');
      }
    } catch {
      setLinkErr('Network error generating link code.');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const copyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(`/link ${code}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const unlink = useCallback(async () => {
    await fetch(`/api/telegram-link?wallet=${encodeURIComponent(walletAddress)}`, { method: 'DELETE' });
    setLinked(false);
    setCode(null);
  }, [walletAddress]);

  if (linked) {
    return (
      <div style={{ background: 'rgba(0,255,167,0.06)', border: '1px solid rgba(0,255,167,0.2)' }} className="rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={13} style={{ color: '#00FFA7' }} />
            <span className="text-xs font-semibold text-slate-200">Telegram Linked</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(0,255,167,0.15)', color: '#00FFA7' }}>✓ Active</span>
          </div>
          <button onClick={unlink} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors font-mono">unlink</button>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
          You will now receive personal alerts when:<br />
          · A trade executes on SoDEX from your wallet<br />
          · Your order ID and status are confirmed
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }} className="rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Send size={13} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-300">Link Telegram</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        Connect your wallet to @ETFSignalAIBot to receive personal trade alerts when your orders execute.
      </p>

      {linkErr && (
        <p className="text-[11px] text-red-400 mb-2 font-mono">{linkErr}</p>
      )}

      {!code ? (
        <button
          onClick={generateCode}
          disabled={loading}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'rgba(0,255,167,0.12)', color: '#00FFA7', border: '1px solid rgba(0,255,167,0.25)' }}
        >
          {loading ? 'Generating...' : 'Generate Link Code'}
        </button>
      ) : (
        <div className="space-y-2">
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,167,0.3)' }}
          >
            <span className="font-mono text-sm font-bold" style={{ color: '#00FFA7' }}>/link {code}</span>
            <button onClick={copyCode} className="text-slate-500 hover:text-white transition-colors ml-2">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 font-mono text-center">
            Send this command to <a href="https://t.me/ETFSignalAIBot" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white underline">@ETFSignalAIBot</a> · expires in 10 min
          </p>
          <button onClick={generateCode} className="w-full text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
            Generate new code
          </button>
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  const {
    wallet, activeTab, setActiveTab,
    signal, signalLoading,
    openTradeModal, handleAnalyze, switchToValueChain,
    liveBtcPx, liveEthPx, latestBtcPx, latestEthPx,
    tradeHistory,
  } = useDashboard();

  const builderConfig = useMemo(() => getBuilderConfig(), []);
  const isLocked = wallet.connected && wallet.networkStatus === 'locked';
  const isWrongNetwork = Boolean(
    wallet.connected &&
    !isLocked &&
    wallet.chainId != null &&
    wallet.chainId !== ACTIVE_VALUECHAIN.chainId,
  );
  const manualOnlyWrongNetwork = isWrongNetwork && wallet.canAutoSwitch === false;
  const connectedNetworkLabel = !wallet.connected
    ? ACTIVE_VALUECHAIN.label
    : isLocked
    ? 'Wallet locked'
    : wallet.chainId != null
    ? (wallet.chainName ?? getChainDisplayName(wallet.chainId))
    : 'Detecting…';
  const connectedChainIdLabel = !wallet.connected
    ? String(ACTIVE_VALUECHAIN.chainId)
    : isLocked
    ? 'Locked'
    : wallet.chainId != null
    ? String(wallet.chainId)
    : '—';

  const assets = [
    {
      id: 'btc' as const,
      label: 'BTC',
      icon: '₿',
      name: 'Bitcoin',
      price: liveBtcPx ?? latestBtcPx ?? null,
      pair: USE_TESTNET ? 'vBTC / vUSDC' : 'BTC / USDC',
    },
    {
      id: 'eth' as const,
      label: 'ETH',
      icon: 'Ξ',
      name: 'Ethereum',
      price: liveEthPx ?? latestEthPx ?? null,
      pair: USE_TESTNET ? 'vETH / vUSDC' : 'ETH / USDC',
    },
  ];

  const currentAsset = assets.find(a => a.id === activeTab)!;
  const signalDir = signal?.direction ?? null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight size={18} style={{ color: '#FF7637' }} />
          <h1 className="text-xl font-bold text-white">SoDEX Trade</h1>
        </div>
        <p className="text-sm text-slate-400">
          Trade BTC &amp; ETH pairs on SoDEX {USE_TESTNET ? `testnet · chain ${ACTIVE_VALUECHAIN.chainId}` : `mainnet · ${ACTIVE_VALUECHAIN.name} chain ${ACTIVE_VALUECHAIN.chainId}`}
        </p>
      </div>

      {/* Network notice */}
      {USE_TESTNET ? (
        <div
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        >
          <span className="text-yellow-400 text-sm shrink-0 mt-0.5">⚠️</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <span className="text-yellow-400 font-semibold">Testnet mode:</span> Orders are submitted and signed correctly via EIP-712.
          </p>
        </div>
      ) : (
        <div
          style={{ background: 'rgba(0,255,167,0.06)', border: '1px solid rgba(0,255,167,0.2)' }}
          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        >
          <Sparkles size={16} style={{ color: '#00FFA7' }} className="shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">SoDEX Mainnet Trading:</span> Real mainnet order execution on {ACTIVE_VALUECHAIN.name} (Chain ID {ACTIVE_VALUECHAIN.chainId}). Every order is signed via EIP-712 and routed with integrated <span className="font-mono text-[#00FFA7]">Builder Fee ({builderConfig.fee / 10} bps)</span>{builderConfig.id ? ` · Builder ID #${builderConfig.id}` : ''}.
          </div>
        </div>
      )}

      {/* Asset selector */}
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-1 flex gap-1"
      >
        {assets.map(a => (
          <button
            key={a.id}
            onClick={() => setActiveTab(a.id)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === a.id
              ? { background: 'rgba(255,118,55,0.15)', color: '#FF7637', border: '1px solid rgba(255,118,55,0.3)' }
              : { color: '#64748B', border: '1px solid transparent' }
            }
          >
            <span className="font-mono">{a.icon}</span>
            {a.label}
            {a.price && (
              <span className="font-mono text-xs text-slate-400">
                ${a.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pair info card */}
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-5 flex items-center justify-between"
      >
        <div>
          <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Trading pair</div>
          <div className="text-xl font-bold font-mono text-white">{currentAsset.pair}</div>
          <div className="text-xs text-slate-500 mt-1">SoDEX {USE_TESTNET ? 'Testnet' : 'Mainnet'} · Spot &amp; Perps</div>
        </div>
        {currentAsset.price && (
          <div className="text-right">
            <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">Market price</div>
            <div className="text-2xl font-bold font-mono text-white">
              ${currentAsset.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>

      {/* AI Signal context (if available) */}
      {signal && (
        <div
          style={{
            background: signalDir === 'BULLISH'
              ? 'rgba(52,211,153,0.08)'
              : signalDir === 'BEARISH'
              ? 'rgba(248,113,113,0.08)'
              : 'rgba(148,163,184,0.08)',
            border: `1px solid ${
              signalDir === 'BULLISH' ? 'rgba(52,211,153,0.25)'
              : signalDir === 'BEARISH' ? 'rgba(248,113,113,0.25)'
              : 'rgba(148,163,184,0.2)'
            }`,
          }}
          className="rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} style={{ color: '#00FFA7' }} />
            <span className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: '#00FFA7' }}>
              The Agent Signal · {currentAsset.label}
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{
                background: signalDir === 'BULLISH'
                  ? 'rgba(52,211,153,0.15)'
                  : signalDir === 'BEARISH'
                  ? 'rgba(248,113,113,0.15)'
                  : 'rgba(148,163,184,0.12)',
                color: signalDir === 'BULLISH' ? '#34D399' : signalDir === 'BEARISH' ? '#F87171' : '#94A3B8',
              }}
            >
              {signalDir} · {signal.confidence}%
            </span>
            {signal.source === 'fallback' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                Rule-based fallback
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{signal.headline}</p>
        </div>
      )}

      {/* Optional signal suggestion (never blocks trading) */}
      {!signal && !signalLoading && (
        <div
          style={{ background: 'rgba(0,255,167,0.05)', border: '1px dashed rgba(0,255,167,0.18)' }}
          className="rounded-xl p-4 flex items-start gap-3"
        >
          <Zap size={16} style={{ color: '#00FFA7', marginTop: 2 }} className="shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-slate-300 font-medium">Optional: Get an Agent signal</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                Optional
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Run The Agent&apos;s ETF flow analysis for directional context before executing, or place a manual Buy/Sell order directly anytime.
            </p>
            <button
              onClick={handleAnalyze}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ background: '#00FFA7', color: '#06080B' }}
            >
              <Sparkles size={12} className="shrink-0" />
              Analyze {currentAsset.label} now
            </button>
          </div>
        </div>
      )}

      {signalLoading && (
        <div className="flex items-center gap-3 text-sm text-slate-400 px-1">
          <div
            className="w-4 h-4 rounded-full border-2 border-transparent animate-spin shrink-0"
            style={{ borderTopColor: '#00FFA7' }}
          />
          Analyzing {currentAsset.label} ETF flows…
        </div>
      )}

      {/* Trade buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => openTradeModal('BUY')}
          disabled={!wallet.connected || manualOnlyWrongNetwork}
          className="py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: wallet.connected && !manualOnlyWrongNetwork
              ? 'linear-gradient(135deg, #059669, #10B981)'
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
            boxShadow: wallet.connected && !manualOnlyWrongNetwork ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
          }}
        >
          <TrendingUp size={16} />
          Buy {currentAsset.label}
        </button>

        <button
          onClick={() => openTradeModal('SELL')}
          disabled={!wallet.connected || manualOnlyWrongNetwork}
          className="py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: wallet.connected && !manualOnlyWrongNetwork
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
            boxShadow: wallet.connected && !manualOnlyWrongNetwork ? '0 4px 20px rgba(239,68,68,0.3)' : 'none',
          }}
        >
          <TrendingDown size={16} />
          Sell {currentAsset.label}
        </button>
      </div>

      {!wallet.connected && (
        <p className="text-xs text-center text-slate-600 font-mono -mt-2">
          Connect wallet above to enable trading on SoDEX
        </p>
      )}

      {isLocked && (
        <div
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)' }}
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 -mt-2"
        >
          <p className="text-xs text-amber-300">
            {wallet.networkError ?? `Unlock your wallet to connect to ${ACTIVE_VALUECHAIN.name} (${ACTIVE_VALUECHAIN.chainId}).`}
          </p>
          <button
            type="button"
            onClick={() => void switchToValueChain?.()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/35 hover:bg-amber-400/30 transition-colors shrink-0"
          >
            Unlock wallet · Retry
          </button>
        </div>
      )}

      {manualOnlyWrongNetwork && (
        <div
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}
          className="rounded-xl px-4 py-3 space-y-1.5 -mt-2"
        >
          <p className="text-xs font-semibold text-amber-300">
            Buy / Sell disabled — switch to {ACTIVE_VALUECHAIN.name} in your wallet
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {wallet.networkError ?? `Connected to ${connectedNetworkLabel} (${connectedChainIdLabel}), and this wallet does not support automatic switching. Add or switch manually:`}
          </p>
          <p className="text-[11px] font-mono text-amber-200/90">
            Network: {ACTIVE_VALUECHAIN.name} · Chain ID: {ACTIVE_VALUECHAIN.chainId} · Currency: {ACTIVE_VALUECHAIN.nativeCurrency.symbol} · RPC: {ACTIVE_VALUECHAIN.rpcUrl}
          </p>
        </div>
      )}

      {isWrongNetwork && !manualOnlyWrongNetwork && (
        <div
          style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}
          className="rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 -mt-2"
        >
          <p className="text-xs text-amber-300">
            Connected to <span className="font-mono font-semibold">{connectedNetworkLabel} ({connectedChainIdLabel})</span>. {wallet.networkError ?? `Switch to ${ACTIVE_VALUECHAIN.name} before signing.`}
          </p>
          <button
            type="button"
            onClick={() => void switchToValueChain?.()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/35 hover:bg-amber-400/30 transition-colors shrink-0"
          >
            Switch to {ACTIVE_VALUECHAIN.name}
          </button>
        </div>
      )}

      {/* Deposit / Faucet banner */}
      {USE_TESTNET ? (
        <a
          href={`${ACTIVE_VALUECHAIN.sodexUrl}/trade/spot/${currentAsset.id === 'btc' ? 'BTC_USDC' : 'ETH_USDC'}?action=claim`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-90 group"
          style={{ background: 'rgba(0,255,167,0.06)', border: '1px dashed rgba(0,255,167,0.2)' }}
        >
          <div className="flex items-center gap-2.5">
            <Droplets size={15} style={{ color: '#00FFA7' }} className="shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Need testnet USDC?</div>
              <div className="text-[11px] text-slate-500">Claim free {currentAsset.label} &amp; USDC from the SoDEX faucet</div>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: 'rgba(0,255,167,0.12)', color: '#00FFA7' }}>
            Claim →
          </span>
        </a>
      ) : (
        <a
          href={`${ACTIVE_VALUECHAIN.sodexUrl}/trade/spot/${currentAsset.id === 'btc' ? 'BTC_USDC' : 'ETH_USDC'}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-90 group"
          style={{ background: 'rgba(0,255,167,0.06)', border: '1px dashed rgba(0,255,167,0.2)' }}
        >
          <div className="flex items-center gap-2.5">
            <Droplets size={15} style={{ color: '#00FFA7' }} className="shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Deposit on SoDEX Mainnet</div>
              <div className="text-[11px] text-slate-500">Fund your account with USDC or {currentAsset.label} on {ACTIVE_VALUECHAIN.name} →</div>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: 'rgba(0,255,167,0.12)', color: '#00FFA7' }}>
            Deposit →
          </span>
        </a>
      )}

      {/* Info strip */}
      <div
        style={{ background: 'var(--brand-panel)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-4 grid grid-cols-3 gap-4 text-center"
      >
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">Network</div>
          <div
            className={`text-sm font-semibold font-mono ${
              isLocked || isWrongNetwork ? 'text-amber-300' : 'text-slate-200'
            }`}
            data-testid="trade-connected-network"
          >
            {connectedNetworkLabel}
          </div>
          {isWrongNetwork && (
            <button
              type="button"
              onClick={() => void switchToValueChain?.()}
              className="mt-1 text-[10px] font-mono text-amber-300 underline hover:text-amber-200"
            >
              Switch to {ACTIVE_VALUECHAIN.name}
            </button>
          )}
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">Chain ID</div>
          <div
            className={`text-sm font-semibold font-mono ${
              isLocked || isWrongNetwork ? 'text-amber-300' : 'text-slate-200'
            }`}
            data-testid="trade-connected-chain-id"
          >
            {connectedChainIdLabel}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">Settlement</div>
          <div className="text-sm font-semibold font-mono text-slate-200">
            {ACTIVE_VALUECHAIN.settlementCurrency}
          </div>
        </div>
      </div>

      {/* Telegram link */}
      {wallet.connected && wallet.address && (
        <TelegramLinkCard walletAddress={wallet.address} />
      )}

      {/* Trade history */}
      {tradeHistory.length > 0 && (
        <div style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }} className="rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <ClockIcon size={13} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Execution History</span>
            <span className="ml-auto text-[10px] font-mono text-slate-600">{tradeHistory.length} trade{tradeHistory.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {tradeHistory.slice(0, 10).map(t => {
              const isLong = t.side === 'BUY';
              const sideColor = isLong ? '#34D399' : '#F87171';
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Side pill */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 font-mono"
                    style={{ background: isLong ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: sideColor }}
                  >
                    {isLong ? 'BUY' : 'SELL'}
                  </span>

                  {/* Pair + size */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200 font-mono">{t.pair}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {t.size} {t.currency}{t.price ? ` @ $${t.price}` : ''} · {t.type}
                    </div>
                  </div>

                  {/* Status + time */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-semibold text-emerald-400">Submitted</div>
                    <div className="text-[10px] text-slate-600 font-mono">{timeAgo(t.timestamp)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
