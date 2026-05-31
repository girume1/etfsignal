import { useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
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

  // Check link status on first render (useEffect, not useState)
  useEffect(() => {
    fetch(`/api/telegram-link?wallet=${encodeURIComponent(walletAddress)}`)
      .then(r => r.json())
      .then((d: any) => setLinked(d.linked ?? false))
      .catch(() => setLinked(false));
  }, [walletAddress]);

  const generateCode = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress }),
      });
      const data: any = await res.json();
      if (data.code) setCode(data.code);
    } catch { /* silent */ }
    finally { setLoading(false); }
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
        <p className="text-[11px] text-slate-500 mt-1.5">You'll receive personal alerts when your trades execute.</p>
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
    openTradeModal, handleAnalyze,
    liveBtcPx, liveEthPx, latestBtcPx, latestEthPx,
    tradeHistory,
  } = useDashboard();

  const assets = [
    {
      id: 'btc' as const,
      label: 'BTC',
      icon: '₿',
      name: 'Bitcoin',
      price: liveBtcPx ?? latestBtcPx ?? null,
      pair: 'vBTC / vUSDC',
    },
    {
      id: 'eth' as const,
      label: 'ETH',
      icon: 'Ξ',
      name: 'Ethereum',
      price: liveEthPx ?? latestEthPx ?? null,
      pair: 'vETH / vUSDC',
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
          Trade BTC &amp; ETH spot pairs on SoDEX testnet · chain 138565
        </p>
      </div>

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
          <div className="text-xs text-slate-500 mt-1">SoDEX Testnet · Spot</div>
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
              AI Signal · {currentAsset.label}
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
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{signal.headline}</p>
        </div>
      )}

      {/* No signal nudge */}
      {!signal && !signalLoading && (
        <div
          style={{ background: 'rgba(0,255,167,0.05)', border: '1px dashed rgba(0,255,167,0.18)' }}
          className="rounded-xl p-4 flex items-start gap-3"
        >
          <Zap size={16} style={{ color: '#00FFA7', marginTop: 2 }} className="shrink-0" />
          <div>
            <p className="text-sm text-slate-300 font-medium mb-1">Get an AI signal first</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Run Claude's ETF flow analysis to get a BULLISH / BEARISH direction before executing. Signals improve your entry timing.
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
          disabled={!wallet.connected}
          className="py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: wallet.connected
              ? 'linear-gradient(135deg, #059669, #10B981)'
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
            boxShadow: wallet.connected ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
          }}
        >
          <TrendingUp size={16} />
          Long {currentAsset.label}
        </button>

        <button
          onClick={() => openTradeModal('SELL')}
          disabled={!wallet.connected}
          className="py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: wallet.connected
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
            boxShadow: wallet.connected ? '0 4px 20px rgba(239,68,68,0.3)' : 'none',
          }}
        >
          <TrendingDown size={16} />
          Short {currentAsset.label}
        </button>
      </div>

      {!wallet.connected && (
        <p className="text-xs text-center text-slate-600 font-mono -mt-2">
          Connect wallet above to enable trading on SoDEX testnet
        </p>
      )}

      {/* Faucet banner */}
      <a
        href="https://testnet.sodex.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-90 group"
        style={{ background: 'rgba(0,255,167,0.06)', border: '1px dashed rgba(0,255,167,0.2)' }}
      >
        <div className="flex items-center gap-2.5">
          <Droplets size={15} style={{ color: '#00FFA7' }} className="shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-200">Need testnet USDC?</div>
            <div className="text-[11px] text-slate-500">Visit testnet.sodex.com → Faucet</div>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: 'rgba(0,255,167,0.12)', color: '#00FFA7' }}>
          Get funds →
        </span>
      </a>

      {/* Info strip */}
      <div
        style={{ background: 'var(--brand-panel)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-4 grid grid-cols-3 gap-4 text-center"
      >
        {[
          { label: 'Network', value: 'ValueChain' },
          { label: 'Chain ID', value: '138565' },
          { label: 'Settlement', value: 'vUSDC' },
        ].map(item => (
          <div key={item.label}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">{item.label}</div>
            <div className="text-sm font-semibold font-mono text-slate-200">{item.value}</div>
          </div>
        ))}
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
                    {isLong ? 'LONG' : 'SHORT'}
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
