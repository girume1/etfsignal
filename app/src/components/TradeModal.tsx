import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JsonRpcSigner } from 'ethers';
import {
  X, TrendingUp, Zap, Target, ArrowUp, ArrowDown,
  RefreshCw, ExternalLink, AlertTriangle, Shield,
  ChevronUp, ChevronDown, CheckCircle2, XCircle,
} from 'lucide-react';
import type { MarketSignal, OrderSide, TradeOrder, WalletNetworkStatus } from '../types';
import {
  fetchBalances, getPerpsMaxLeverage, getQuantityPrecision, updatePerpsCollateral,
  getBuilderConfig, validateOrderMinimum, SPOT_MIN_NOTIONAL_USD, PERPS_MIN_NOTIONAL_USD,
} from '../services/sodex';
import { ACTIVE_VALUECHAIN, USE_TESTNET, getChainDisplayName } from '../config/valuechain';
import { ensureWalletOnValueChain, isWalletLockedError, WALLET_LOCKED_MESSAGE } from '../services/walletNetwork';
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
    risk.clamped && `Clamped to 10 ${ACTIVE_VALUECHAIN.settlementCurrency} minimum`,
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
  signal?: MarketSignal | null;
  side: OrderSide;
  symbol: string;
  walletAddress?: string | null;
  walletChainId?: number | null;
  walletNetworkStatus?: WalletNetworkStatus;
  onSwitchNetwork?: () => Promise<boolean>;
  currentPrice?: number;
  signer?: JsonRpcSigner | null;
  onConfirm: (order: TradeOrder) => Promise<{ orderId: string }>;
  onClose: () => void;
}

const PERCENTS = [0, 25, 50, 75, 100];

function SegmentBtn({
  active,
  onClick,
  bgColor,
  color,
  borderCol,
  children,
}: {
  active: boolean;
  onClick: () => void;
  bgColor: string;
  color: string;
  borderCol: string;
  children: React.ReactNode;
}) {
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

export function TradeModal({
  signal, side, symbol, walletAddress, walletChainId, walletNetworkStatus, onSwitchNetwork,
  currentPrice, signer, onConfirm, onClose,
}: TradeModalProps) {
  const baseAsset   = symbol.split('-')[0]; // BTC or ETH
  const quoteAsset  = symbol.split('-')[1]; // USDC

  // ── Order state ──────────────────────────────────────────────────────────
  // SELL orders must use base asset (BTC/ETH) — funds field is BUY-only on SoDEX
  const [currency,     setCurrency]     = useState<string>(side === 'SELL' ? baseAsset : quoteAsset);
  const [marketType,   setMarketType]   = useState<'spot' | 'futures'>('spot');
  const [orderType,    setOrderType]    = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [amount,       setAmount]       = useState(side === 'SELL' ? '0.001' : '10');
  const [limitPriceInput, setLimitPriceInput] = useState<string | null>(null);
  const limitPrice = limitPriceInput ?? (currentPrice ? currentPrice.toFixed(2) : '');
  const setLimitPrice = (next: string) => setLimitPriceInput(next);
  const [pct,          setPct]          = useState(0);
  const [dropOpen,     setDropOpen]     = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [result,       setResult]       = useState<{
    success: boolean;
    message: string;
    orderId?: string;
    wrongNetwork?: boolean;
    walletLocked?: boolean;
  } | null>(null);
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

  const loadBalances = useCallback(async () => {
    if (!walletAddress) return;
    await Promise.resolve();
    setBalLoading(true);
    try {
      const next = await fetchBalances(walletAddress);
      setBalances(next);
    } catch {
      setBalances({});
    } finally {
      setBalLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadBalances();
    });
    return () => {
      cancelled = true;
    };
  }, [loadBalances]);

  // Real per-symbol leverage cap (e.g. 40x for BTC-USD) — was hardcoded to a
  // 20x picker regardless of what the market actually allows.
  useEffect(() => {
    if (marketType !== 'futures') return;
    getPerpsMaxLeverage(`${baseAsset}-USD`)
      .then(m => { setMaxLeverage(m); setLeverage(l => Math.min(l, m)); })
      .catch(() => {});
  }, [marketType, baseAsset]);

  // Spot MARKET BUY sends SoDEX's native `funds` field (proven working). Every
  // other quote-currency case — any LIMIT order (schema forbids `funds` on
  // LIMIT entirely), and perps MARKET (untested/unreliable on this gateway —
  // saw real "invalid order size" rejections) — is instead converted client-side
  // into an exact base-asset quantity below, using the best known reference price.
  const fundsAllowed =
    (orderType === 'MARKET' && (marketType === 'futures' || side === 'BUY')) ||
    orderType === 'LIMIT';

  const selectMarketType = useCallback((nextMarket: 'spot' | 'futures') => {
    const nextOrder = nextMarket === 'futures' ? 'MARKET' : orderType;
    setMarketType(nextMarket);
    if (nextMarket === 'futures') {
      setOrderType('MARKET');
      setPct(0);
      setAmount(currency === baseAsset ? '0.001' : '50');
    } else {
      const nextFundsAllowed =
        (nextOrder === 'MARKET' && side === 'BUY') || nextOrder === 'LIMIT';
      if (!nextFundsAllowed && currency !== baseAsset) {
        setCurrency(baseAsset);
        setPct(0);
      }
    }
  }, [orderType, currency, baseAsset, side]);

  const selectOrderType = useCallback((nextOrder: 'MARKET' | 'LIMIT') => {
    setOrderType(nextOrder);
    if (nextOrder === 'LIMIT' && !limitPrice && currentPrice) {
      setLimitPrice(currentPrice.toFixed(2));
    }
    const nextFundsAllowed =
      (nextOrder === 'MARKET' && (marketType === 'futures' || side === 'BUY')) ||
      nextOrder === 'LIMIT';
    if (!nextFundsAllowed && currency !== baseAsset) {
      setCurrency(baseAsset);
      setPct(0);
    }
  }, [limitPrice, currentPrice, marketType, side, currency, baseAsset]);

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

  // TP/SL must be validated against the actual entry price — the limit price
  // for LIMIT orders, not the live market price (which can differ a lot from
  // where a resting limit order will actually fill).
  const entryPrice = orderType === 'LIMIT' ? parseFloat(limitPrice || '0') || undefined : currentPrice;
  const customTpPct = takeProfitPrice && entryPrice && entryPrice > 0
    ? Math.abs(((Number(takeProfitPrice) - entryPrice) / entryPrice) * 100)
    : 0;
  const customSlPct = stopLossPrice && entryPrice && entryPrice > 0
    ? Math.abs(((Number(stopLossPrice) - entryPrice) / entryPrice) * 100)
    : 0;
  const riskConfidence = signal?.confidence ?? 50;
  const riskTpPct = signal?.takeProfit?.pct ?? customTpPct;
  const riskSlPct = signal?.stopLoss?.pct ?? customSlPct;
  const riskSlPrice = signal?.stopLoss?.price ?? (stopLossPrice ? Number(stopLossPrice) : undefined);

  const tpInvalid = Boolean(takeProfitPrice && entryPrice &&
    (side === 'BUY' ? Number(takeProfitPrice) <= entryPrice : Number(takeProfitPrice) >= entryPrice));
  const slInvalid = Boolean(stopLossPrice && entryPrice &&
    (side === 'BUY' ? Number(stopLossPrice) >= entryPrice : Number(stopLossPrice) <= entryPrice));

  const orderMinCheck = useMemo(
    () =>
      validateOrderMinimum({
        symbol: marketType === 'futures' ? `${baseAsset}-USD` : symbol,
        quantity: amount,
        currency,
        marketType,
        referencePrice: entryPrice,
      }),
    [marketType, baseAsset, symbol, amount, currency, entryPrice],
  );

  async function handleSubmit() {
    if (!acknowledged) return;
    if (orderType === 'LIMIT' && !limitPrice) return;
    if (tpInvalid || slInvalid) return;
    if (!orderMinCheck.valid) {
      setResult({ success: false, message: orderMinCheck.error ?? 'Order below minimum size.' });
      return;
    }

    // Spot MARKET BUY sends SoDEX's native `funds` field (proven working, see
    // confirmTrade). Every other quote-currency case — LIMIT orders (schema
    // forbids `funds` entirely) and perps MARKET (unreliable on this gateway) —
    // is converted here into an exact base-asset quantity instead, using the
    // best known reference price (limit price if set, else live market price).
    // If no reference price is available, refuse to submit rather than
    // silently falling back to the known-broken `funds` path.
    const isQuoteCurrency = currency !== baseAsset;
    const needsClientConversion = isQuoteCurrency && (orderType === 'LIMIT' || marketType === 'futures');
    const referencePrice = orderType === 'LIMIT' ? parseFloat(limitPrice || '0') : (currentPrice ?? 0);
    if (needsClientConversion && referencePrice <= 0) {
      setResult({ success: false, message: `Live price unavailable — refresh and try again, or size in ${baseAsset} instead.` });
      return;
    }

    setSubmitting(true);
    try {
      let finalQuantity = amount;
      if (needsClientConversion) {
        const conversionSymbol = marketType === 'futures' ? `${baseAsset}-USD` : symbol;
        const qtyPrecision = await getQuantityPrecision(conversionSymbol, marketType).catch(() => 6);
        finalQuantity = (parseFloat(amount) / referencePrice).toFixed(qtyPrecision);
      }
      const finalCurrency = needsClientConversion ? baseAsset : currency;

      const { orderId } = await onConfirm(
        marketType === 'futures'
          ? {
              symbol:   `${baseAsset}-USD`, // perps symbol format, distinct from spot's BTC-USDC
              side,
              type:     orderType,
              quantity: finalQuantity,
              currency: finalCurrency,
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
              quantity: finalQuantity,
              currency: finalCurrency,   // BTC or USDC — determines quantity vs funds on SoDEX
              ...(orderType === 'LIMIT' ? { price: limitPrice } : {}),
            },
      );
      setResult({ success: true, message: '', orderId });
    } catch (err: unknown) {
      const errObj = typeof err === 'object' && err !== null ? (err as { message?: unknown; walletLocked?: unknown; wrongNetwork?: unknown }) : {};
      const msg = typeof errObj.message === 'string' && errObj.message ? errObj.message : 'Order failed';
      const walletLocked = Boolean(errObj.walletLocked || isWalletLockedError(err));
      const wrongNetwork = !walletLocked && Boolean(
        errObj.wrongNetwork || /wrong\s*network|switch.*valuechain|chain\s*id/i.test(msg),
      );
      setResult({
        success: false,
        message: walletLocked ? WALLET_LOCKED_MESSAGE : msg,
        wrongNetwork,
        walletLocked,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitchToValueChain() {
    setSwitchingNetwork(true);
    try {
      if (onSwitchNetwork) {
        const ok = await onSwitchNetwork();
        if (ok) {
          setResult(null);
          return;
        }
      } else {
        const res = await ensureWalletOnValueChain({ signer });
        if (res.ok) {
          setResult(null);
          return;
        }
        setResult({
          success: false,
          message: res.error || `Could not switch to ${ACTIVE_VALUECHAIN.name}.`,
          wrongNetwork: res.status !== 'locked',
          walletLocked: res.status === 'locked',
        });
      }
    } catch (err: unknown) {
      const locked = isWalletLockedError(err);
      const errMsg = err instanceof Error ? err.message : undefined;
      setResult({
        success: false,
        message: locked ? WALLET_LOCKED_MESSAGE : (errMsg || `Could not switch to ${ACTIVE_VALUECHAIN.name}.`),
        wrongNetwork: !locked,
        walletLocked: locked,
      });
    } finally {
      setSwitchingNetwork(false);
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
    } catch (err: unknown) {
      setCollateralMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCollateralBusy(false);
    }
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
                SoDEX {USE_TESTNET ? 'Testnet' : 'Mainnet'} · {marketType === 'spot' ? 'Spot' : `Futures · ${leverage}x ${marginMode}`} · {orderType === 'MARKET' ? 'Market' : 'Limit'} · {currency}
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
              <SegmentBtn
                active={marketType === 'spot'}
                onClick={() => selectMarketType('spot')}
                bgColor={bgColor}
                color={color}
                borderCol={borderCol}
              >
                <span className="flex items-center justify-center gap-1.5"><TrendingUp size={13} /> Spot</span>
              </SegmentBtn>
              <SegmentBtn
                active={marketType === 'futures'}
                onClick={() => selectMarketType('futures')}
                bgColor={bgColor}
                color={color}
                borderCol={borderCol}
              >
                <span className="flex items-center justify-center gap-1.5"><Zap size={13} /> Futures</span>
              </SegmentBtn>
            </div>

            {/* ── Row 2: Market / Limit (spot and perps both support LIMIT) ── */}
            <div
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              className="flex rounded-xl p-1 mb-4 gap-1"
            >
              <SegmentBtn
                active={orderType === 'MARKET'}
                onClick={() => selectOrderType('MARKET')}
                bgColor={bgColor}
                color={color}
                borderCol={borderCol}
              >
                <span className="flex items-center justify-center gap-1.5"><Zap size={13} /> Market</span>
              </SegmentBtn>
              <SegmentBtn
                active={orderType === 'LIMIT'}
                onClick={() => selectOrderType('LIMIT')}
                bgColor={bgColor}
                color={color}
                borderCol={borderCol}
              >
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
            {signal ? (
              <div
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
                className="rounded-xl p-3 mb-4"
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs text-slate-500">Based on signal</span>
                  {signal.source === 'fallback' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Rule-based fallback
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-300 leading-snug">{signal.headline}</div>
                <div className="text-xs mt-1.5 font-medium" style={{ color }}>
                  {signal.direction} · {signal.confidence}% confidence
                </div>
              </div>
            ) : (
              <div
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
                className="rounded-xl p-3 mb-4"
              >
                <div className="text-xs font-semibold text-slate-300 mb-0.5">No AI signal, manual order</div>
                <div className="text-xs text-slate-500 leading-snug">
                  Manual execution with default sizing (50% neutral confidence, 10 vUSDC floor / 20% ceiling). Set optional TP/SL below.
                </div>
              </div>
            )}

            {/* ── Risk panel (position sizing + risk/reward) ────────────── */}
            <RiskPanel
              balance={riskBalance}
              defaultBalance={riskDefaultBalance}
              confidence={riskConfidence}
              tpPct={riskTpPct}
              slPct={riskSlPct}
              entryPrice={currentPrice}
              slPrice={riskSlPrice}
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
                    min order ${marketType === 'futures' ? PERPS_MIN_NOTIONAL_USD : SPOT_MIN_NOTIONAL_USD}
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
                    <span className="text-xs font-semibold text-slate-300">No {quoteAsset} found on SoDEX</span>
                    <a
                      href={`${ACTIVE_VALUECHAIN.sodexUrl}/trade/spot/${baseAsset}_USDC`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                      style={{ color: '#00FFA7' }}
                    >
                      Deposit on SoDEX
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  </div>
                  <ol className="text-[10px] text-slate-500 space-y-0.5 list-none">
                    <li>1. Connect your wallet at <a href={ACTIVE_VALUECHAIN.sodexUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 underline">{ACTIVE_VALUECHAIN.sodexHost}</a> (registers your account)</li>
                    <li>2. Deposit {quoteAsset} to your SoDEX account</li>
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
              {!orderMinCheck.valid && orderMinCheck.error && (
                <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} className="shrink-0" />
                  {orderMinCheck.error}
                </p>
              )}
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
              <p className="text-xs text-slate-400 leading-relaxed">
                {signal?.riskWarning ?? 'Manual order placed without an AI signal. Verify your entry price, position size, and risk limits independently.'}
              </p>
              {marketType === 'futures' && (
                <p className="text-xs text-slate-400 leading-relaxed mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(251,191,36,0.15)' }}>
                  Leverage amplifies both gains and losses. At {leverage}x, a small adverse price move can liquidate your entire margin.
                </p>
              )}
            </div>

            {/* ── Connected network warning / Builder fee indicator ───── */}
            {walletNetworkStatus === 'locked' && (
              <div
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)' }}
                className="rounded-xl px-3 py-2 mb-3 text-xs text-amber-300"
              >
                {WALLET_LOCKED_MESSAGE}
              </div>
            )}
            {walletNetworkStatus !== 'locked' && walletChainId != null && walletChainId !== ACTIVE_VALUECHAIN.chainId && (
              <div
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)' }}
                className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2 text-xs text-amber-300"
              >
                <span>
                  Connected to {getChainDisplayName(walletChainId)} ({walletChainId}) instead of {ACTIVE_VALUECHAIN.name}.
                </span>
                <button
                  type="button"
                  onClick={() => void handleSwitchToValueChain()}
                  disabled={switchingNetwork}
                  className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/35 hover:bg-amber-400/30 font-semibold shrink-0 disabled:opacity-50"
                >
                  {switchingNetwork ? 'Switching…' : `Switch to ${ACTIVE_VALUECHAIN.name}`}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-3 px-1">
              <span>Network: {ACTIVE_VALUECHAIN.label} ({ACTIVE_VALUECHAIN.chainId})</span>
              <span style={{ color: '#00FFA7' }}>Builder Fee: {(getBuilderConfig().fee / 10).toFixed(1)} bps{getBuilderConfig().id ? ` (#${getBuilderConfig().id})` : ''}</span>
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
                I understand this is a live trade, I am responsible for my own decisions, and this is not financial advice.
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
                  Your {marketType === 'spot' ? (isLong ? 'buy' : 'sell') : (isLong ? 'long' : 'short')} {orderType === 'LIMIT' ? 'limit' : 'market'} order was submitted to SoDEX.
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
                  href={`${ACTIVE_VALUECHAIN.sodexUrl}/trade/${marketType}/${sodexSymbol}`}
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
              <>
                <p className="text-sm text-slate-400 mb-4 whitespace-pre-line">{result.message}</p>
                {result.wrongNetwork && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void handleSwitchToValueChain()}
                      disabled={switchingNetwork}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/40 hover:bg-amber-400/30 transition-colors disabled:opacity-50"
                    >
                      {switchingNetwork ? 'Switching…' : `Switch to ${ACTIVE_VALUECHAIN.name}`}
                    </button>
                  </div>
                )}
                {result.walletLocked && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/40 hover:bg-amber-400/30 transition-colors"
                    >
                      Unlock wallet &amp; retry
                    </button>
                  </div>
                )}
              </>
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
