import { useEffect } from 'react';
import { X, Zap, BarChart2, Bot, TrendingUp, ShieldCheck } from 'lucide-react';

interface AIAdvantageModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    icon: BarChart2,
    color: '#00FFA7',
    title: 'ETF Flow Intelligence',
    desc: 'We pull real-time institutional ETF inflow & outflow data from SoSoValue — tracking IBIT, FBTC, ARKB and 12+ funds daily. Big money moves markets before retail notices.',
  },
  {
    icon: Bot,
    color: '#A78BFA',
    title: 'Claude AI Analysis',
    desc: 'Anthropic\'s Claude synthesizes ETF flows, live news sentiment, and macro context into a structured BULLISH / BEARISH / NEUTRAL signal with confidence score, key factors, TP & SL levels.',
  },
  {
    icon: TrendingUp,
    color: '#34D399',
    title: 'Actionable Trade Signals',
    desc: 'Each signal includes an entry zone, take-profit target, stop-loss level, and risk warning — everything you need to make an informed decision, not just raw numbers.',
  },
  {
    icon: ShieldCheck,
    color: '#FF7637',
    title: 'EIP-712 Signed Execution',
    desc: 'Execute directly on SoDEX testnet. Your orders are signed with your wallet key using EIP-712 — no private keys leave your device, no centralized custody.',
  },
];

const STATS = [
  { value: '12+', label: 'ETF funds tracked' },
  { value: 'Real-time', label: 'Binance price feed' },
  { value: 'Claude AI', label: 'Anthropic Sonnet' },
  { value: 'EIP-712', label: 'On-chain signed' },
];

export function AIAdvantageModal({ onClose }: AIAdvantageModalProps) {
  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          background: 'var(--brand-panel)',
          border: '1px solid rgba(0,255,167,0.2)',
          boxShadow: '0 0 60px rgba(0,255,167,0.08), 0 32px 80px rgba(0,0,0,0.6)',
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        className="relative rounded-2xl p-6 slide-up"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,255,167,0.12)', border: '1px solid rgba(0,255,167,0.25)' }}
          >
            <Zap size={18} style={{ color: '#00FFA7' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Advantage</h2>
            <p className="text-xs text-slate-400">How ETFSignal AI finds high-probability trades</p>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4 grid grid-cols-4 gap-3 mb-6 text-center"
        >
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-sm font-bold font-mono" style={{ color: '#00FFA7' }}>{s.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pipeline steps */}
        <div className="space-y-4 mb-6">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex gap-4 p-4 rounded-xl card-hover"
              style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
              >
                <step.icon size={16} style={{ color: step.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Data attribution */}
        <div
          style={{ background: 'rgba(255,118,55,0.06)', border: '1px solid rgba(255,118,55,0.15)' }}
          className="rounded-xl p-3 mb-4 flex items-center gap-3"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)' }}
          >S</div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Powered by SoSoValue</div>
            <div className="text-[10px] text-slate-500">
              Real institutional ETF flow data · updated daily ·{' '}
              <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer"
                className="text-orange-400 hover:text-orange-300 underline">sosovalue.com</a>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-600 text-center leading-relaxed">
          ETFSignal AI is a research tool. AI signals are not financial advice.
          All trading is on SoDEX testnet — no real funds at risk.
        </p>
      </div>
    </div>
  );
}
