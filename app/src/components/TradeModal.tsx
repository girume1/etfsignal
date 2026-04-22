import { useState } from 'react';
import type { MarketSignal, OrderSide, TradeOrder } from '../types';

interface TradeModalProps {
  signal: MarketSignal;
  side: OrderSide;
  symbol: string;
  onConfirm: (order: TradeOrder) => Promise<void>;
  onClose: () => void;
}

export function TradeModal({ signal, side, symbol, onConfirm, onClose }: TradeModalProps) {
  const [quantity, setQuantity] = useState('0.01');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isLong = side === 'BUY';
  const color = isLong ? '#34D399' : '#F87171';
  const bgColor = isLong ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)';
  const borderColor = isLong ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)';

  async function handleSubmit() {
    if (!acknowledged) return;
    setSubmitting(true);
    try {
      await onConfirm({
        symbol,
        side,
        type: 'MARKET',
        quantity,
      });
      setResult({ success: true, message: `Order submitted to SoDEX testnet!` });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{ background: 'var(--brand-panel)', border: `1px solid ${borderColor}`, maxWidth: '440px', width: '100%' }}
        className="relative rounded-2xl p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              style={{ background: bgColor, border: `1px solid ${borderColor}`, color }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            >
              {isLong ? '↑' : '↓'}
            </div>
            <div>
              <div className="font-semibold text-white">{isLong ? 'Long' : 'Short'} {symbol}</div>
              <div className="text-xs text-slate-500">SoDEX Testnet · Market Order</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {!result ? (
          <>
            {/* Signal context */}
            <div
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--brand-border)' }}
              className="rounded-xl p-4 mb-4"
            >
              <div className="text-xs text-slate-500 mb-1">Based on signal</div>
              <div className="text-sm text-slate-300">{signal.headline}</div>
              <div className="text-xs mt-2" style={{ color }}>
                {signal.direction} · {signal.confidence}% confidence
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-2">
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0.001"
                step="0.001"
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', color: 'white' }}
                className="w-full px-4 py-3 rounded-xl font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Risk warning */}
            <div
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
              className="rounded-xl p-4 mb-4"
            >
              <div className="text-xs font-semibold text-yellow-400 mb-1">⚠ Risk Warning</div>
              <p className="text-xs text-slate-400">{signal.riskWarning}</p>
              <p className="text-xs text-slate-500 mt-2">
                This is a <strong className="text-yellow-500">testnet</strong> trade using simulated funds. Past signals do not guarantee future performance. Not financial advice.
              </p>
            </div>

            {/* Acknowledgment */}
            <label className="flex items-start gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-1 accent-blue-500"
              />
              <span className="text-sm text-slate-400">
                I understand this is a testnet trade, I am responsible for my own decisions, and this is not financial advice.
              </span>
            </label>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!acknowledged || submitting}
              style={{
                background: acknowledged ? (isLong ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)') : 'rgba(255,255,255,0.05)',
                border: `1px solid ${acknowledged ? borderColor : 'transparent'}`,
                color: acknowledged ? color : '#475569',
              }}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Submitting...</>
                : `Confirm ${isLong ? 'Long' : 'Short'} ${quantity} ${symbol.split('-')[0]}`
              }
            </button>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">{result.success ? '✅' : '❌'}</div>
            <p className={`text-lg font-semibold mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Order Submitted!' : 'Order Failed'}
            </p>
            <p className="text-sm text-slate-400 mb-6">{result.message}</p>
            <button
              onClick={onClose}
              style={{ background: 'var(--brand-blue)' }}
              className="px-6 py-2.5 rounded-xl text-white font-semibold"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
