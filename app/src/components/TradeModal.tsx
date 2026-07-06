import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JsonRpcSigner } from 'ethers';
import {
  X, TrendingUp, Zap, Target, ArrowUp, ArrowDown,
  ArrowUpDown, RefreshCw, ExternalLink, AlertTriangle, Shield,
  ChevronUp, ChevronDown, CheckCircle2, XCircle,
} from 'lucide-react';
import type { MarketSignal, OrderSide, TradeOrder } from '../types';
import { fetchBalances, getPerpsMaxLeverage, updatePerpsCollateral } from '../services/sodex';
import { computePositionSize, computeLeveragedRisk, type LeveragedRiskResult } from '../services/riskManager';

function RiskPanel({
  balance, defaultBalance, confidence, tpPct, slPct, entryPrice, slPrice, amountUsd,
  leverage, side,
}: {
  balance: number; defaultBalance: boolean; confidence: number;
  tpPct: number; slPct: number; entryPrice?: number; slPrice?: number; amountUsd: number;
  leverage?: number; side?: OrderSide;
}) {
  const isFutures = leverage !== undefined && side !== undefined;

  const risk = useMemo(() => {
    const input = {
      balance,
      confidence: confidence / 100,
      tpPct: Math.abs(tpPct),
      slPct: Math.abs(slPct),
      entryPrice,
      slPrice,
      defaultBalance,
    };
    return isFutures
      ? computeLeveragedRisk({ ...input, leverage: leverage!, side: side! })
      : computePositionSize(input);
  }, [balance, confidence, tpPct, slPct, entryPrice, slPrice, defaultBalance, isFutures, leverage, side]);

  const leveraged: LeveragedRiskResult | null = isFutures ? (risk as LeveragedRiskResult) : null;

  const warnings = [
    risk.riskRewardWarning && 'Risk/reward below 1.5x',
    risk.atrWarning && 'Stop-loss beyond 3x ATR',
    risk.clamped && 'Clamped to 10 vUSDC minimum',
    risk.capped && 'Capped to 20% of balance',
    leveraged?.liquidationWarning && 'Liquidation within 15% of entry',
  ].filter((w): w is string => Boolean(w));

  return (
    <div
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-3 mb-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <Shield size={12} /> Suggested Position (half-Kelly)
        </span>
        {risk.defaultBalance && (
          <span className="text-[9px] text-amber-400 font-mono">using default balance</span>
        )}
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-lg font-bold text-white">${risk.positionSize.toFixed(2)}</span>
        <span className="text-xs font-mono" style={{ color: risk.riskRewardWarning ? '#F87171' : '#34D399' }}>
          R:R {risk.riskRewardRatio.toFixed(2)}x
        </span>
      </div>
      <div className="text-[10px] text-slate-600 font-mono mb-1.5">
        Your amount: ${amountUsd.toFixed(2)} ({risk.positionSize > 0 ? (amountUsd / risk.positionSize).toFixed(1) : '—'}x recommended)
      </div>
      {leveraged && (
        <div className="grid grid-cols-2 gap-2 mb-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="text-[9px] text-slate-600 font-mono uppercase">Margin Required</div>
            <div className="text-xs font-mono text-white">${leveraged.marginRequired.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-600 font-mono uppercase">Est. Liquidation</div>
            <div className="text-xs font-mono" style={{ color: leveraged.liquidationWarning ? '#F87171' : '#E2E8F0' }}>
              {leveraged.liquidationPrice > 0 ? `$${leveraged.liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
            </div>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5">
          {warnings.map(w => (
            <li key={w} className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertTriangle size={10} className="shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TradeModalProps {
  signal: MarketSignal;
  side: OrderSide;
  symbol: string;
  walletAddress?: string | null;
  currentPrice?: number;
  signer?: JsonRpcSigner | null;
  onConfirm: (order: TradeOrder) => Promise<{ orderId: string }>;
  onClose: () => void;
}

const PERCENTS = [0, 25, 50, 75, 100];

export function TradeModal({
  signal, side, symbol, walletAddress, currentPrice, signer, onConfirm, onClose,
}: TradeModalProps) {
  const baseAsset   = symbol.split('-')[0]; // BTC or ETH
  const quoteAsset  = symbol.split('-')[1]; // USDC

  // ── Order state ──────────────────────────────────────────────────────────
  // SELL orders must use base asset (BTC/ETH) — funds field is BUY-only on SoDEX
  const [currency,     setCurrency]     = useState<string>(side === 'SELL' ? baseAsset : quoteAsset);
  const [marketType,   setMarketType]   = useState<'spot' | 'futures'>('spot');
  const [orderType,    setOrderType]    = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [amount,       setAmount]       = useState(side === 'SELL' ? '0.001' : '10');
  const [limitPrice,   setLimitPrice]   = useState(
    currentPrice ? currentPrice.toFixed(2) : ''
  );
  const [pct,          setPct]          = useState(0);
  const [dropOpen,     setDropOpen]     = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState<{ success: boolean; message: string; orderId?: string } | null>(null);
  const [leverage,     setLeverage]     = useState(20);
  const [maxLeverage,  setMaxLeverage]  = useState(20);
  const [marginMode,   setMarginMode]   = useState<'ISOLATED' | 'CROSS'>('ISOLATED');
  const [reduceOnly,   setReduceOnly]   = useState(false);
  const [slippagePct,  setSlippagePct]  = useState('0.5');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossPrice,   setStopLossPrice]   = useState('');

  // ── Cross-margin collateral ("Asset Mode") ───────────────────────────────
  const collateralCoin = baseAsset === 'BTC' ? 'ETH' : 'BTC';
  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralAction, setCollateralAction] = useState<'add' | 'remove'>('add');
  const [collateralBusy,   setCollateralBusy]   = useState(false);
  const [collateralMsg,    setCollateralMsg]    = useState<string | null>(null);

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

  // Reset amount when switching into futures — schema allows sizing by either
  // base-asset quantity or USDC funds on perps, unlike spot (SELL is base-asset only)
  useEffect(() => {
    if (marketType === 'futures') {
      setPct(0);
      setAmount(currency === baseAsset ? '0.001' : '50');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketType]);

  // Real per-symbol leverage cap (e.g. 40x for BTC-USD) — was hardcoded to a
  // 20x picker regardless of what the market actually allows.
  useEffect(() => {
    if (marketType !== 'futures') return;
    getPerpsMaxLeverage(`${baseAsset}-USD`)
      .then(m => { setMaxLeverage(m); setLeverage(l => Math.min(l, m)); })
      .catch(() => {});
  }, [marketType, baseAsset]);

  // SoDEX only accepts quote-currency (funds) sizing for MARKET orders — spot
  // restricts it further to BUY only, perps allows either side. LIMIT orders
  // never send a `funds` field to SoDEX (the schema forbids it), but since the
  // limit price is known up front (unlike MARKET), a USDC amount can still be
  // converted client-side into an exact base-asset `quantity` before submit —
  // offered for futures limit orders per user request. Picking the "wrong"
  // currency without this conversion would silently be reinterpreted as a
  // base-asset quantity server-side (e.g. typing "50" meaning $50 sent as 50 BTC).
  const fundsAllowed =
    (orderType === 'MARKET' && (marketType === 'futures' || side === 'BUY')) ||
    (orderType === 'LIMIT' && marketType === 'futures');
  useEffect(() => {
    if (!fundsAllowed && currency !== baseAsset) {
      setCurrency(baseAsset);
      setPct(0);
    }
  }, [fundsAllowed, currency, baseAsset]);

  // ── Risk panel: debounced amount → quote-asset (USD) terms ────────────────
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), 300);
    return () => clearTimeout(t);
  }, [amount]);

  // ── Derived symbol (perps uses BTC-USD, distinct from spot's BTC-USDC) ────
  const displaySymbol = marketType === 'futures' ? `${baseAsset}-USD` : symbol;
  // SoDEX's UI URLs differ by market: spot uses underscores (BTC_USDC), futures keeps the hyphen (BTC-USD)
  const sodexSymbol   = marketType === 'futures' ? displaySymbol : displaySymbol.replace('-', '_');

  // ── Derived colours ──────────────────────────────────────────────────────
  const isLong    = side === 'BUY';
  const color     = isLong ? '#34D399' : '#F87171';
  const bgColor   = isLong ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)';
  const borderCol = isLong ? 'rgba(52,211,153,0.3)'  : 'rgba(248,113,113,0.3)';

  // ── Balance helpers ──────────────────────────────────────────────────────
  const availableRaw = balances[currency];
  const available    = availableRaw !== undefined ? parseFloat(availableRaw) : null;
  const isBalanceZero = available !== null && available === 0;

  // ── Risk sizing inputs (quote-asset/vUSDC terms) ───────────────────────────
  const quoteBalanceRaw   = balances[quoteAsset];
  const quoteBalance      = quoteBalanceRaw !== undefined ? parseFloat(quoteBalanceRaw) : null;
  const riskBalance       = quoteBalance ?? 100; // ponytail: no ATR data source in this codebase — omitted from RiskPanel, not fabricated
  const riskDefaultBalance = quoteBalance === null;
  const amountUsd = currency === baseAsset
    ? parseFloat(debouncedAmount || '0') * (currentPrice ?? 0)
    : parseFloat(debouncedAmount || '0');

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
  // MARKET orders can optionally bound their fill price (slippage protection):
  // exchange caps execution at indexPrice*(1±ratio) either way, this just tightens it.
  const protectivePrice = useMemo(() => {
    if (marketType !== 'futures' || orderType !== 'MARKET' || !currentPrice) return undefined;
    const pct = parseFloat(slippagePct);
    if (!slippagePct || isNaN(pct) || pct <= 0) return undefined;
    const bound = side === 'BUY' ? currentPrice * (1 + pct / 100) : currentPrice * (1 - pct / 100);
    return bound.toFixed(2);
  }, [marketType, orderType, currentPrice, slippagePct, side]);

  const tpInvalid = Boolean(takeProfitPrice && currentPrice &&
    (side === 'BUY' ? Number(takeProfitPrice) <= currentPrice : Number(takeProfitPrice) >= currentPrice));
  const slInvalid = Boolean(stopLossPrice && currentPrice &&
    (side === 'BUY' ? Number(stopLossPrice) >= currentPrice : Number(stopLossPrice) <= currentPrice));

  async function handleSubmit() {
    if (!acknowledged) return;
    if (orderType === 'LIMIT' && !limitPrice) return;
    if (tpInvalid || slInvalid) return;
    setSubmitting(true);
    try {
      const { orderId } = await onConfirm(
        marketType === 'futures'
          ? {
              symbol:   `${baseAsset}-USD`, // perps symbol format, distinct from spot's BTC-USDC
              side,
              type:     orderType,
              quantity: amount,
              currency,            // BTC (quantity) or USDC (funds, MARKET only) — perps allows either side
              marketType: 'futures',
              leverage,
              marginMode,
              reduceOnly,
              ...(takeProfitPrice ? { takeProfitPrice } : {}),
              ...(stopLossPrice ? { stopLossPrice } : {}),
              ...(orderType === 'LIMIT'
                ? { price: limitPrice }
                : protectivePrice ? { price: protectivePrice } : {}),
            }
          : {
              symbol,
              side,
              type:     orderType,
              quantity: amount,
              currency,            // BTC or USDC — determines quantity vs funds on SoDEX
              ...(orderType === 'LIMIT' ? { price: limitPrice } : {}),
            },
      );
      setResult({ success: true, message: '', orderId });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCollateral() {
    if (!signer || !collateralAmount) return;
    setCollateralBusy(true);
    setCollateralMsg(null);
    try {
      const signedAmount = collateralAction === 'add' ? collateralAmount : `-${collateralAmount}`;
      const r = await updatePerpsCollateral(signer, collateralCoin, signedAmount);
      setCollateralMsg(r.success ? `${collateralAction === 'add' ? 'Added' : 'Removed'} ${collateralAmount} ${collateralCoin}` : r.error ?? 'Failed');
      if (r.success) setCollateralAmount('');
    } catch (err: any) {
      setCollateralMsg(err.message || 'Failed');
    } finally {
      setCollateralBusy(false);
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
              <div className="font-semibold text-white">
                {marketType === 'spot'
                  ? (isLong ? 'Buy' : 'Sell')
                  : (isLong ? 'Long' : 'Short')
                } {displaySymbol}
              </div>
              <div className="text-xs text-slate-500">
                SoDEX Testnet · {marketType === 'spot' ? 'Spot' : `Futures · ${leverage}x ${marginMode}`} · {orderType === 'MARKET' ? 'Market' : 'Limit'} · {currency}
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
              <SegmentBtn active={marketType === 'spot'} onClick={() => setMarketType('spot')}>
                <span className="flex items-center justify-center gap-1.5"><TrendingUp size={13} /> Spot</span>
              </SegmentBtn>
              <SegmentBtn active={marketType === 'futures'} onClick={() => { setMarketType('futures'); setOrderType('MARKET'); }}>
                <span className="flex items-center justify-center gap-1.5"><Zap size={13} /> Futures</span>
              </SegmentBtn>
            </div>

            {/* ── Row 2: Market / Limit (spot and perps both support LIMIT) ── */}
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
                // Spot limit orders always quantity (base asset) — futures limit
                // orders allow USDC sizing too (converted to quantity on submit).
                if (marketType !== 'futures') setCurrency(baseAsset);
              }}>
                <span className="flex items-center justify-center gap-1.5"><Target size={13} /> Limit</span>
              </SegmentBtn>
            </div>

            {/* ── Leverage + Margin Mode (futures only) ───────────────────── */}
            {marketType === 'futures' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Leverage</label>
                  <span className="text-[10px] text-slate-600 font-mono">max {maxLeverage}x</span>
                </div>
                <div
                  style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                  className="flex rounded-xl p-1 gap-1 mb-2"
                >
                  {[2, 5, 10, 20, maxLeverage].filter((l, i, arr) => l <= maxLeverage && arr.indexOf(l) === i).sort((a, b) => a - b).map(lev => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={leverage === lev
                        ? { background: bgColor, color, border: `1px solid ${borderCol}` }
                        : { color: '#64748b', border: '1px solid transparent' }
                      }
                    >
                      {lev}x
                    </button>
                  ))}
                </div>

                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">Margin Mode</label>
                <div
                  style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                  className="flex rounded-xl p-1 gap-1"
                >
                  {(['ISOLATED', 'CROSS'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setMarginMode(mode)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                      style={marginMode === mode
                        ? { background: bgColor, color, border: `1px solid ${borderCol}` }
                        : { color: '#64748b', border: '1px solid transparent' }
                      }
                    >
                      {mode.charAt(0) + mode.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                {/* Cross-margin collateral ("Asset Mode") — testnet-only endpoint */}
                {marginMode === 'CROSS' && (
                  <div
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
                    className="rounded-xl p-3 mt-2"
                  >
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
                      Cross-margin Collateral · {collateralCoin}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={collateralAction}
                        onChange={e => setCollateralAction(e.target.value as 'add' | 'remove')}
                        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                        className="px-2 py-2 rounded-lg text-xs font-semibold"
                      >
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                      </select>
                      <input
                        type="number"
                        value={collateralAmount}
                        onChange={e => setCollateralAmount(e.target.value)}
                        placeholder={`0.00 ${collateralCoin}`}
                        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg font-mono text-xs focus:outline-none"
                      />
                      <button
                        onClick={handleCollateral}
                        disabled={!signer || !collateralAmount || collateralBusy}
                        style={{ background: bgColor, color, border: `1px solid ${borderCol}` }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0"
                      >
                        {collateralBusy ? '…' : 'Go'}
                      </button>
                    </div>
                    {collateralMsg && (
                      <p className="text-[10px] text-slate-400 mt-1.5">{collateralMsg}</p>
                    )}
                  </div>
                )}
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

            {/* ── Risk panel (position sizing + risk/reward) ────────────── */}
            <RiskPanel
              balance={riskBalance}
              defaultBalance={riskDefaultBalance}
              confidence={signal.confidence}
              tpPct={signal.takeProfit.pct}
              slPct={signal.stopLoss.pct}
              entryPrice={currentPrice}
              slPrice={signal.stopLoss.price}
              amountUsd={amountUsd}
              {...(marketType === 'futures' ? { leverage, side } : {})}
            />

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

            {/* ── Slippage Tolerance (futures market orders only) ─────────── */}
            {marketType === 'futures' && orderType === 'MARKET' && (
              <div className="mb-3">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">
                  Slippage Tolerance
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={slippagePct}
                    onChange={e => setSlippagePct(e.target.value)}
                    placeholder="0.5"
                    min="0"
                    step="0.1"
                    style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                    className="w-24 px-3 py-2 rounded-xl font-mono text-sm focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">
                    % — bounds fill to {protectivePrice ? `$${protectivePrice}` : 'exchange default'}
                  </span>
                </div>
              </div>
            )}

            {/* ── TP/SL + Reduce Only (futures only) ──────────────────────── */}
            {marketType === 'futures' && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">Take Profit</label>
                  <input
                    type="number"
                    value={takeProfitPrice}
                    onChange={e => setTakeProfitPrice(e.target.value)}
                    placeholder="Optional"
                    style={{ background: 'var(--brand-card)', border: `1px solid ${tpInvalid ? '#F87171' : 'var(--brand-border)'}`, color: 'white' }}
                    className="w-full px-3 py-2 rounded-xl font-mono text-sm focus:outline-none"
                  />
                  {tpInvalid && <p className="text-[10px] text-red-400 mt-1">Must be {side === 'BUY' ? 'above' : 'below'} entry</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5 block">Stop Loss</label>
                  <input
                    type="number"
                    value={stopLossPrice}
                    onChange={e => setStopLossPrice(e.target.value)}
                    placeholder="Optional"
                    style={{ background: 'var(--brand-card)', border: `1px solid ${slInvalid ? '#F87171' : 'var(--brand-border)'}`, color: 'white' }}
                    className="w-full px-3 py-2 rounded-xl font-mono text-sm focus:outline-none"
                  />
                  {slInvalid && <p className="text-[10px] text-red-400 mt-1">Must be {side === 'BUY' ? 'below' : 'above'} entry</p>}
                </div>
                <label className="col-span-2 flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={reduceOnly}
                    onChange={e => setReduceOnly(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-slate-400">Reduce Only — only close, never increase, position size</span>
                </label>
              </div>
            )}

            {/* ── Amount + Currency selector ────────────────────────────── */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  Amount
                  <span className="text-[10px] text-slate-600 normal-case font-normal">
                    min order {marketType === 'futures' ? '$10' : '$5'}
                  </span>
                </label>

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

                {/* Currency dropdown — USDC/funds sizing only offered where SoDEX actually accepts it */}
                {!fundsAllowed ? (
                  <div
                    style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                    className="flex items-center px-3 py-3 rounded-xl text-white font-semibold text-sm whitespace-nowrap"
                    title={marketType === 'spot' ? 'SoDEX only accepts USDC sizing for spot market buys' : undefined}
                  >
                    {baseAsset}
                  </div>
                ) : (
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
                )}
              </div>
              {marketType === 'futures' && (
                <p className="text-[10px] text-slate-600 mt-1.5">
                  Balance shown is your spot wallet — perps margin is a separate SoDEX sub-account.
                </p>
              )}
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
              {marketType === 'futures' && (
                <p className="text-xs text-slate-400 leading-relaxed mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(251,191,36,0.15)' }}>
                  Leverage amplifies both gains and losses. At {leverage}x, a small adverse price move can liquidate your entire margin — this is testnet, but the mechanics mirror mainnet risk.
                </p>
              )}
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
              disabled={!acknowledged || submitting || (orderType === 'LIMIT' && !limitPrice) || tpInvalid || slInvalid}
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
                `Place Limit ${marketType === 'spot' ? (isLong ? 'Buy' : 'Sell') : (isLong ? 'Long' : 'Short')} · ${amount} ${currency} @ $${limitPrice || '—'}`
              ) : marketType === 'spot' ? (
                `${isLong ? 'Buy' : 'Sell'} ${amount} ${currency}`
              ) : (
                `${isLong ? 'Long' : 'Short'} ${amount} ${currency}`
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
                  Your {marketType === 'spot' ? (isLong ? 'buy' : 'sell') : (isLong ? 'long' : 'short')} {orderType === 'LIMIT' ? 'limit' : 'market'} order was submitted to SoDEX Testnet.
                </p>

                {/* Order proof card */}
                <div
                  style={{ background: 'rgba(0,255,167,0.06)', border: '1px solid rgba(0,255,167,0.2)' }}
                  className="rounded-xl p-4 mb-4 text-left space-y-2"
                >
                  {[
                    { label: 'Order ID',  value: result.orderId ?? '—', mono: true },
                    { label: 'Status',    value: 'Submitted ✓' },
                    { label: 'Pair',      value: displaySymbol, mono: true },
                    { label: 'Side', value: marketType === 'spot' ? (isLong ? 'BUY' : 'SELL') : (isLong ? 'LONG' : 'SHORT') },
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
