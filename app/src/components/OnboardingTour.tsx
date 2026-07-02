import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Zap, ArrowLeftRight, X } from 'lucide-react';

const SEEN_KEY = 'etfsignal:tour-seen';

const STEPS = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Live BTC & ETH ETF metrics, AI signal generation, sentiment gauge, and your activity feed — all in one place.',
    path: '/app',
  },
  {
    icon: BarChart2,
    title: 'ETF Flows',
    body: 'Track institutional inflow/outflow trends over 14, 30, or 90 days, with streak analysis and SMA overlays.',
    path: '/app/flows',
  },
  {
    icon: Zap,
    title: 'AI Signals',
    body: 'Claude analyzes flows, news, and momentum to produce directional signals with real backtested performance.',
    path: '/app/signals',
  },
  {
    icon: ArrowLeftRight,
    title: 'SoDEX Trade',
    body: 'Execute signals directly on SoDEX testnet, with half-Kelly position sizing and risk/reward guardrails.',
    path: '/app/trade',
  },
];

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}

function markTourSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
}

export function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  function finish() {
    markTourSeen();
    onDone();
  }

  function next() {
    if (isLast) { finish(); return; }
    navigate(STEPS[step + 1].path);
    setStep(s => s + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={finish} />

      <div
        style={{ background: 'var(--brand-panel)', border: '1px solid var(--brand-border)', maxWidth: 380 }}
        className="relative rounded-2xl p-6 w-full shadow-2xl"
      >
        <button onClick={finish} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors" aria-label="Skip tour">
          <X size={16} />
        </button>

        <div
          style={{ background: 'rgba(0,255,167,0.1)', border: '1px solid rgba(0,255,167,0.25)', color: '#00FFA7' }}
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        >
          <Icon size={22} />
        </div>

        <h2 className="text-lg font-bold text-white mb-1.5">{current.title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">{current.body}</p>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 20 : 6, background: i === step ? '#00FFA7' : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={finish} className="text-xs text-slate-500 hover:text-white transition-colors font-medium">
            Skip
          </button>
          <button
            onClick={next}
            style={{ background: '#00FFA7', color: '#06080B' }}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
