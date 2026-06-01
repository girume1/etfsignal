import { useState, useEffect, useCallback } from 'react';
import {
  X, TrendingUp, Zap, Target, ArrowUp, ArrowDown,
  ArrowUpDown, RefreshCw, ExternalLink, AlertTriangle,
  ChevronUp, ChevronDown, CheckCircle2, XCircle,
} from 'lucide-react';
import type { MarketSignal, OrderSide, TradeOrder } from '../types';
import { fetchBalances } from '../services/sodex';

interface TradeModalProps {
  signal: MarketSignal;
  side: OrderSide;
  symbol: string;
  walletAddress?: string | null;
  currentPrice?: number;
  onConfirm: (order: TradeOrder) => Promise<{ orderId: string }>;
  onClose: () => void;
}

const PERCENTS = [0, 25, 50, 75, 100];

export function TradeModal({
  signal, side, symbol, walletAddress, currentPrice, onConfirm, onClose,
}: TradeModalProps) {
  const baseAsset   = symbol.split('-')[0]; // BTC or ETH
  const quoteAsset  = symbol.split('-')[1]; // USDC
  const sodexSymbol = symbol.replace('-', '_');

  // ── Order state ──────────────────────────────────────────────────────────
  const [currency,     setCurrency]     = useState<string>(baseAsset);
  const [marketType,   setMarketType]   = useState<'spot' | 'futures'>('spot');
  const [orderType,    setOrderType]    = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [amount,       setAmount]       = useState('0.01');
  const [limitPrice,   setLimitPrice]   = useState(
    currentPrice ? currentPrice.toFixed(2) : ''
  );
  const [pct,          setPct]          = useState(0);
  const [dropOpen,     setDropOpen]     = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState<{ success: boolean; message: string; orderId?: string } | null>(null);

  // ── Balance state ────────────────────────────────────────────────────────
  const [balances,   setBalances]   = useState<Record<string, string>>({});
  const [balLoading, setBalLoading] = useState(false);

  const loadBalances = useCallback(() => {
    if (!walletAddress) return;
    setBalLoading(true);
    fetchBalances(walletAddress)
      .then(setBalances)
      .catch(() => setBalances({}))
      .finally(() => setBalLoading(false));
  }, [walletAddress]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  // Pre-fill limit price when currentPrice changes (e.g. live tick)
  useEffect(() => {
    if (currentPrice && orderType === 'LIMIT' && !limitPrice) {
      setLimitPrice(currentPrice.toFixed(2));
    }
  }, [currentPrice, orderType, limitPrice]);

  // ── Derived colours ──────────────────────────────────────────────────────
  const isLong    = side === 'BUY';
  const color     = isLong ? '#34D399' : '#F87171';
  const bgColor   = isLong ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)';
  const borderCol = isLong ? 'rgba(52,211,153,0.3)'  : 'rgba(248,113,113,0.3)';

  // ── Balance helpers ──────────────────────────────────────────────────────
  const availableRaw = balances[currency];
  const available    = availableRaw !== undefined ? parseFloat(availableRaw) : null;
  const isBalanceZero = available !== null && available === 0;

  function formatBalance(val: number | null): string {
    if (val === null) return '—';
    if (currency === baseAsset)
      return val.toFixed(6).replace(/\.?0+$/, '') || '0';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── % slider ─────────────────────────────────────────────────────────────
  function handlePct(p: number) {
    setPct(p);
    const base = available ?? (currency === baseAsset ? 0.1 : 1000);
    setAmount(((base * p) / 100).toFixed(currency === baseAsset ? 6 : 2));
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!acknowledged) return;
    if (orderType === 'LIMIT' && !limitPrice) return;
    setSubmitting(true);
    try {
      const { orderId } = await onConfirm({
        symbol,
        side,
        type: orderType,
        quantity: amount,
        ...(orderType === 'LIMIT' ? { price: limitPrice } : {}),
      });
      setResult({ success: true, message: '', orderId });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Segment button helper ─────────────────────────────────────────────────
  function SegmentBtn({
    active, onClick, children,
  }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        onClick={onClick}
        className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
        style={{
          background: active ? bgColor : 'transparent',
          color:      active ? color   : '#64748b',
          border:     active ? `1px solid ${borderCol}` : '1px solid transparent',
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        style={{
          background: 'var(--brand-panel)',
          border: `1px solid ${borderCol}`,
          maxWidth: '440px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        className="relative rounded-2xl p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              style={{ background: bgColor, border: `1px solid ${borderCol}`, color }}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
            >
              {isLong ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
            </div>
            <div>
              <div className="font-semibold text-white">{isLong ? 'Long' : 'Short'} {symbol}</div>
              <div className="text-xs text-slate-500">
                SoDEX Testnet · {marketType === 'spot' ? 'Spot' : 'Futures'} · {orderType === 'MARKET' ? 'Market' : 'Limit'} · {quoteAsset}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            {/* ── Row 1: Spot / Futures ──────────────────────────────────── */}
            <div
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              className="flex rounded-xl p-1 mb-2 gap-1"
            >
              <SegmentBtn active={marketType === 'spot'}    onClick={() => setMarketType('spot')}>
                <span className="flex items-center justify-center gap-1.5"><TrendingUp size={13} /> Spot</span>
              </SegmentBtn>
              <SegmentBtn active={marketType === 'futures'} onClick={() => setMarketType('futures')}>
                <span className="flex items-center justify-center gap-1.5"><Zap size={13} /> Futures</span>
              </SegmentBtn>
            </div>

            {/* ── Row 2: Market / Limit ──────────────────────────────────── */}
            <div
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              className="flex rounded-xl p-1 mb-4 gap-1"
            >
              <SegmentBtn active={orderType === 'MARKET'} onClick={() => setOrderType('MARKET')}>
                <span className="flex items-center justify-center gap-1.5"><Zap size={13} /> Market</span>
              </SegmentBtn>
              <SegmentBtn active={orderType === 'LIMIT'}  onClick={() => {
                setOrderType('LIMIT');
                if (!limitPrice && currentPrice) setLimitPrice(currentPrice.toFixed(2));
              }}>
                <span className="flex items-center justify-center gap-1.5"><Target size={13} /> Limit</span>
              </SegmentBtn>
            </div>

            {/* ── Futures transfer warning ──────────────────────────────── */}
            {marketType === 'futures' && (
              <div
                style={{ background: 'rgba(168,139,250,0.08)', border: '1px solid rgba(168,139,250,0.25)' }}
                className="rounded-xl p-3 mb-3 flex items-start gap-2"
              >
                <ArrowUpDown size={16} className="text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-purple-300 font-semibold mb-0.5">Transfer required for Futures</p>
                  <p className="text-xs text-slate-400">
                    Move {quoteAsset} from Spot → Futures on SoDEX before trading.{' '}
                    <a
                      href={`https://testnet.sodex.com/trade/futures/${sodexSymbol}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline inline-flex items-center gap-1"
                    >
                      Transfer on SoDEX
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* ── Signal context ────────────────────────────────────────── */}
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

            {/* ── Limit price input ─────────────────────────────────────── */}
            {orderType === 'LIMIT' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Limit Price</label>
                  {currentPrice && (
                    <button
                      onClick={() => setLimitPrice(currentPrice.toFixed(2))}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Use market: ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 pl-1">$</span>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    style={{ background: 'var(--brand-card)', border: `1px solid ${borderCol}`, color: 'white' }}
                    className="flex-1 px-4 py-3 rounded-xl font-mono text-lg focus:outline-none transition-colors"
                  />
                  <span className="text-xs text-slate-500 pr-1">{quoteAsset}</span>
                </div>
              </div>
            )}

            {/* ── Amount + Currency selector ────────────────────────────── */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount</label>

                {/* Available balance */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Available:</span>
                  {balLoading ? (
                    <span className="inline-block w-3 h-3 border border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                  ) : (
                    <button
                      onClick={() => {
                        if (available !== null && available > 0) {
                          setAmount(available.toFixed(currency === baseAsset ? 6 : 2));
                          setPct(100);
                        }
                      }}
                      className="text-xs font-semibold tabular-nums transition-colors hover:opacity-80"
                      style={{ color: available !== null && available > 0 ? color : '#64748b' }}
                      title="Click to use full balance"
                    >
                      {formatBalance(available)} {currency}
                    </button>
                  )}
                  <button
                    onClick={loadBalances}
                    disabled={balLoading}
                    className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40 flex items-center"
                    title="Refresh balance"
                  >
                    <RefreshCw size={11} />
                  </button>
                </div>
              </div>

              {/* Zero / no balance nudge */}
              {(isBalanceZero || available === null) && !balLoading && (
                <div
                  style={{ background: 'rgba(0,255,167,0.05)', border: '1px solid rgba(0,255,167,0.18)' }}
                  className="rounded-xl px-3 py-3 mb-2"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">No {quoteAsset} found on SoDEX Testnet</span>
                    <a
                      href={`https://testnet.sodex.com/trade/spot/${baseAsset}_USDC?action=claim`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                      style={{ color: '#00FFA7' }}
                    >
                      Claim from Faucet
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </div>
                  <ol className="text-[10px] text-slate-500 space-y-0.5 list-none">
                    <li>1. Connect your wallet at <a href="https://testnet.sodex.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 underline">testnet.sodex.com</a> (registers your account)</li>
                    <li>2. Click "Claim from Faucet" above to get free testnet {baseAsset} &amp; USDC</li>
                    <li>3. Return here and click the refresh icon ↻ to reload your balance</li>
                  </ol>
                </div>
              )}

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
                    {dropOpen ? <ChevronUp size={12} className="text-slate-400 shrink-0" /> : <ChevronDown size={12} className="text-slate-400 shrink-0" />}
                  </button>

                  {dropOpen && (
                    <div
                      style={{ background: 'var(--brand-panel)', border: '1px solid var(--brand-border)' }}
                      className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-10 min-w-[90px]"
                    >
                      {[baseAsset, quoteAsset].map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            setCurrency(c);
                            setDropOpen(false);
                            setPct(0);
                            setAmount(c === baseAsset ? '0.01' : '100');
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors font-medium"
                          style={{ color: c === currency ? color : 'white' }}
                        >
                          <div>{c}</div>
                          {balances[c] !== undefined && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {parseFloat(balances[c]).toFixed(c === baseAsset ? 4 : 2)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── % slider ─────────────────────────────────────────────── */}
            <div className="mb-4">
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
                      background:  p <= pct ? color : 'var(--brand-card)',
                      borderColor: p <= pct ? color : 'var(--brand-border)',
                    }}
                  />
                ))}
              </div>
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

            {/* ── Risk warning ──────────────────────────────────────────── */}
            <div
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
              className="rounded-xl p-3 mb-4"
            >
              <div className="text-xs font-semibold text-yellow-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" />
                Risk Warning
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{signal.riskWarning}</p>
            </div>

            {/* ── Acknowledgment ────────────────────────────────────────── */}
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

            {/* ── Submit button ─────────────────────────────────────────── */}
            <button
              onClick={handleSubmit}
              disabled={!acknowledged || submitting || (orderType === 'LIMIT' && !limitPrice)}
              style={{
                background: acknowledged
                  ? (isLong
                      ? 'linear-gradient(135deg,rgba(52,211,153,0.25),rgba(52,211,153,0.15))'
                      : 'linear-gradient(135deg,rgba(248,113,113,0.25),rgba(248,113,113,0.15))')
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${acknowledged ? borderCol : 'transparent'}`,
                color: acknowledged ? color : '#475569',
              }}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Submitting...
                </>
              ) : orderType === 'LIMIT' ? (
                `Place Limit ${isLong ? 'Buy' : 'Sell'} · ${amount} ${currency} @ $${limitPrice || '—'}`
              ) : (
                `Confirm ${isLong ? 'Long' : 'Short'} ${amount} ${currency}`
              )}
            </button>
          </>
        ) : (
          /* ── Result screen ─────────────────────────────────────────── */
          <div className="text-center py-6">
            <div className="mb-4 flex justify-center">
            {result.success
              ? <CheckCircle2 size={48} style={{ color: '#34D399' }} />
              : <XCircle size={48} style={{ color: '#F87171' }} />
            }
          </div>
            <p className={`text-lg font-semibold mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Order Placed!' : 'Order Failed'}
            </p>
            {result.success ? (
              <>
                <p className="text-sm text-slate-400 mb-4">
                  Your {isLong ? 'long' : 'short'} {orderType === 'LIMIT' ? 'limit' : 'market'} order was submitted to SoDEX Testnet.
                </p>

                {/* Order proof card */}
                <div
                  style={{ background: 'rgba(0,255,167,0.06)', border: '1px solid rgba(0,255,167,0.2)' }}
                  className="rounded-xl p-4 mb-4 text-left space-y-2"
                >
                  {[
                    { label: 'Order ID',  value: result.orderId ?? '—', mono: true },
                    { label: 'Status',    value: 'Submitted ✓' },
                    { label: 'Pair',      value: symbol, mono: true },
                    { label: 'Side',      value: isLong ? 'LONG' : 'SHORT' },
                    { label: 'Size',      value: `${amount} ${currency}${orderType === 'LIMIT' ? ` @ $${limitPrice}` : ''}`, mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-500 shrink-0">{label}</span>
                      <span className={`text-xs text-slate-200 text-right truncate ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={`https://testnet.sodex.com/trade/${marketType}/${sodexSymbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: 'linear-gradient(135deg,#00FFA7,#A78BFA)', color: '#06080B' }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  View on SoDEX
                  <ExternalLink size={14} className="shrink-0" />
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
