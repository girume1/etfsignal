import { useState } from 'react';
import type { MarketSignal, OrderSide, TradeOrder } from '../types';

interface TradeModalProps {
  signal: MarketSignal;
  side: OrderSide;
  symbol: string;
  onConfirm: (order: TradeOrder) => Promise<void>;
  onClose: () => void;
}

const PERCENTS = [0, 25, 50, 75, 100];

export function TradeModal({ signal, side, symbol, onConfirm, onClose }: TradeModalProps) {
  const baseAsset   = symbol.split('-')[0]; // BTC or ETH
  const quoteAsset  = symbol.split('-')[1]; // USDC
  // SoDEX URL uses underscores: BTC_USDC
  const sodexSymbol = symbol.replace('-', '_');

  const [currency,     setCurrency]     = useState<string>(baseAsset);
  const [marketType,   setMarketType]   = useState<'spot' | 'futures'>('spot');
  const [amount,       setAmount]       = useState('0.01');
  const [pct,          setPct]          = useState(0);
  const [dropOpen,     setDropOpen]     = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState<{ success: boolean; message: string } | null>(null);

  const isLong    = side === 'BUY';
  const color     = isLong ? '#34D399' : '#F87171';
  const bgColor   = isLong ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)';
  const borderCol = isLong ? 'rgba(52,211,153,0.3)'  : 'rgba(248,113,113,0.3)';

  function handlePct(p: number) {
    setPct(p);
    // Simulate balance scaling: 0.01 BTC = 100% balance
    const base = currency === baseAsset ? 0.1 : 1000;
    setAmount(((base * p) / 100).toFixed(currency === baseAsset ? 4 : 2));
  }

  async function handleSubmit() {
    if (!acknowledged) return;
    setSubmitting(true);
    try {
      await onConfirm({ symbol, side, type: 'MARKET', quantity: amount });
      setResult({ success: true, message: '' });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        style={{ background: 'var(--brand-panel)', border: `1px solid ${borderCol}`, maxWidth: '440px', width: '100%' }}
        className="relative rounded-2xl p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              style={{ background: bgColor, border: `1px solid ${borderCol}`, color }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            >
              {isLong ? '↑' : '↓'}
            </div>
            <div>
              <div className="font-semibold text-white">{isLong ? 'Long' : 'Short'} {symbol}</div>
              <div className="text-xs text-slate-500">SoDEX Testnet · {marketType === 'spot' ? 'Spot' : 'Futures'} · {quoteAsset}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {!result ? (
          <>
            {/* Spot / Futures toggle */}
            <div
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              className="flex rounded-xl p-1 mb-4 gap-1"
            >
              {(['spot', 'futures'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMarketType(t)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: marketType === t ? bgColor : 'transparent',
                    color: marketType === t ? color : '#64748b',
                    border: marketType === t ? `1px solid ${borderCol}` : '1px solid transparent',
                  }}
                >
                  {t === 'spot' ? '📈 Spot' : '⚡ Futures'}
                </button>
              ))}
            </div>

            {/* Futures transfer warning */}
            {marketType === 'futures' && (
              <div
                style={{ background: 'rgba(168,139,250,0.08)', border: '1px solid rgba(168,139,250,0.25)' }}
                className="rounded-xl p-3 mb-3 flex items-start gap-2"
              >
                <span className="text-purple-400 text-sm mt-0.5">↕</span>
                <div>
                  <p className="text-xs text-purple-300 font-semibold mb-0.5">Transfer required for Futures</p>
                  <p className="text-xs text-slate-400">
                    Move {quoteAsset} from Spot → Futures on SoDEX before trading.{' '}
                    <a
                      href={`https://testnet.sodex.com/trade/futures/${sodexSymbol}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      Transfer on SoDEX ↗
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Signal context */}
            <div
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
              className="rounded-xl p-3 mb-4"
            >
              <div className="text-xs text-slate-500 mb-0.5">Based on signal</div>
              <div className="text-sm text-slate-300 leading-snug">{signal.headline}</div>
              <div className="text-xs mt-1.5 font-medium" style={{ color }}>
                {signal.direction} · {signal.confidence}% confidence
              </div>
            </div>

            {/* Amount + Currency selector */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount</label>
                <span className="text-xs text-slate-600">Quantity</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Amount input */}
                <input
                  type="number"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setPct(0); }}
                  min="0.0001"
                  step={currency === baseAsset ? '0.001' : '1'}
                  style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                  className="flex-1 px-4 py-3 rounded-xl font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                />

                {/* Currency dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropOpen(v => !v)}
                    style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                    className="flex items-center gap-1.5 px-3 py-3 rounded-xl text-white font-semibold text-sm whitespace-nowrap hover:border-blue-500 transition-colors"
                  >
                    {currency}
                    <span className="text-slate-400 text-xs">{dropOpen ? '▲' : '▼'}</span>
                  </button>

                  {dropOpen && (
                    <div
                      style={{ background: 'var(--brand-panel)', border: '1px solid var(--brand-border)' }}
                      className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-10 min-w-[90px]"
                    >
                      {[baseAsset, quoteAsset].map(c => (
                        <button
                          key={c}
                          onClick={() => { setCurrency(c); setDropOpen(false); setPct(0); setAmount(c === baseAsset ? '0.01' : '100'); }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors font-medium"
                          style={{ color: c === currency ? color : 'white' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* % Slider */}
            <div className="mb-4">
              {/* Track with dots */}
              <div className="relative flex items-center justify-between px-1 mb-2">
                <div
                  className="absolute left-1 right-1 h-0.5 rounded-full"
                  style={{ background: 'var(--brand-border)', top: '50%', transform: 'translateY(-50%)' }}
                />
                <div
                  className="absolute left-1 h-0.5 rounded-full transition-all duration-200"
                  style={{ background: color, top: '50%', transform: 'translateY(-50%)', width: `${pct}%` }}
                />
                {PERCENTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePct(p)}
                    className="relative z-10 w-3 h-3 rounded-full border-2 transition-all duration-150 hover:scale-125"
                    style={{
                      background: p <= pct ? color : 'var(--brand-card)',
                      borderColor: p <= pct ? color : 'var(--brand-border)',
                    }}
                  />
                ))}
              </div>

              {/* Labels */}
              <div className="flex items-center justify-between px-0.5">
                {PERCENTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePct(p)}
                    className="text-xs transition-colors"
                    style={{ color: p === pct ? color : '#64748b' }}
                  >
                    {p === 0 ? '0%' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk warning */}
            <div
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
              className="rounded-xl p-3 mb-4"
            >
              <div className="text-xs font-semibold text-yellow-400 mb-1">⚠ Risk Warning</div>
              <p className="text-xs text-slate-400 leading-relaxed">{signal.riskWarning}</p>
              <p className="text-xs text-slate-600 mt-1.5">
                Testnet only. Need {quoteAsset}?{' '}
                <a href="https://testnet.sodex.com/faucet" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline">
                  SoDEX Faucet ↗
                </a>
              </p>
            </div>

            {/* Acknowledgment */}
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-1 accent-blue-500"
              />
              <span className="text-xs text-slate-400">
                I understand this is a testnet trade, I am responsible for my own decisions, and this is not financial advice.
              </span>
            </label>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!acknowledged || submitting}
              style={{
                background: acknowledged
                  ? (isLong ? 'linear-gradient(135deg,rgba(52,211,153,0.25),rgba(52,211,153,0.15))' : 'linear-gradient(135deg,rgba(248,113,113,0.25),rgba(248,113,113,0.15))')
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${acknowledged ? borderCol : 'transparent'}`,
                color: acknowledged ? color : '#475569',
              }}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Submitting...</>
                : `Confirm ${isLong ? 'Long' : 'Short'} ${amount} ${currency}`
              }
            </button>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">{result.success ? '✅' : '❌'}</div>
            <p className={`text-lg font-semibold mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Order Placed!' : 'Order Failed'}
            </p>
            {result.success ? (
              <>
                <p className="text-sm text-slate-400 mb-1">
                  Your {isLong ? 'long' : 'short'} order was submitted to SoDEX Testnet.
                </p>
                <p className="text-xs text-slate-600 mb-4">
                  {marketType === 'spot' ? 'Spot' : 'Futures'} · {amount} {currency} · {sodexSymbol}
                </p>
                <a
                  href={`https://testnet.sodex.com/trade/${marketType}/${sodexSymbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: 'linear-gradient(135deg,#00C2FF,#A78BFA)' }}
                  className="inline-block px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  View on SoDEX ↗
                </a>
              </>
            ) : (
              <p className="text-sm text-slate-400 mb-4 whitespace-pre-line">{result.message}</p>
            )}
            <button
              onClick={onClose}
              style={{ background: 'var(--brand-blue)' }}
              className="mt-4 px-6 py-2.5 rounded-xl text-white font-semibold"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
