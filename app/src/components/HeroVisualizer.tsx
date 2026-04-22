import { useEffect, useState } from 'react';

/**
 * Animated "Flow → AI → Signal" pipeline for the landing hero.
 *
 *    ┌─ IBIT  ─┐
 *    ├─ FBTC ─┤─►  [ CLAUDE ]  ─► ↑ BULLISH 82%
 *    ├─ ARKB ─┤
 *    └─ BITB ─┘
 *
 * Pure SVG — no chart library. The flow lines use stroke-dasharray +
 * a moving dashoffset so the dashes appear to flow from left to right.
 */
export function HeroVisualizer() {
  // Simulated live ticking values so the viz feels alive
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const funds = [
    { label: 'IBIT', base: 312, vari: 18,  color: '#00C2FF' },
    { label: 'FBTC', base: 142, vari: 14,  color: '#0057FF' },
    { label: 'ARKB', base:  48, vari:  8,  color: '#A78BFA' },
    { label: 'BITB', base:  22, vari:  6,  color: '#34D399' },
  ];

  // Pseudo-random but deterministic per-tick oscillation
  const jitter = (i: number) => Math.sin((tick + i * 1.3) * 0.9) * 0.5 + 0.5;

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, rgba(13,20,40,0.8) 0%, rgba(17,24,39,0.6) 100%)',
        border: '1px solid var(--brand-border)',
        backdropFilter: 'blur(14px)',
      }}
      className="relative rounded-2xl p-5 max-w-3xl mx-auto slide-up overflow-hidden"
    >
      {/* subtle grid background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="hv-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#00C2FF" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hv-grid)" />
      </svg>

      <div className="relative grid grid-cols-12 gap-3 items-center">
        {/* ── Left: live inflow feed ──────────────────────────────────── */}
        <div className="col-span-4 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
            Institutional flows
          </div>
          {funds.map((f, i) => {
            const amt = f.base + Math.round(f.vari * (jitter(i) * 2 - 1));
            const positive = amt >= 0;
            const pct = Math.min(100, (Math.abs(amt) / 350) * 100);
            return (
              <div
                key={f.label}
                className="flex items-center gap-2 text-[11px] font-mono"
              >
                <span className="w-10 text-slate-300">{f.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${f.color}, ${f.color}aa)`,
                      boxShadow: `0 0 8px ${f.color}66`,
                    }}
                  />
                </div>
                <span
                  className="w-14 text-right tabular-nums"
                  style={{ color: positive ? '#34D399' : '#F87171' }}
                >
                  {positive ? '+' : ''}
                  {amt}M
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Middle: animated flow lines + AI core ─────────────────── */}
        <div className="col-span-4 relative h-36 flex items-center justify-center">
          <svg viewBox="0 0 240 140" className="w-full h-full">
            <defs>
              <linearGradient id="flow-grad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"  stopColor="#00C2FF" stopOpacity="0" />
                <stop offset="50%" stopColor="#00C2FF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0057FF" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="out-grad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"  stopColor="#A78BFA" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="ai-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor="#00C2FF" stopOpacity="0.6" />
                <stop offset="60%" stopColor="#0057FF" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0057FF" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* inbound lines — 4 funds feeding the core */}
            {[28, 56, 84, 112].map((y, i) => (
              <path
                key={i}
                d={`M 0 ${y} C 60 ${y}, 80 70, 110 70`}
                stroke="url(#flow-grad)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 6"
                className="flow-dash"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}

            {/* AI core glow */}
            <circle cx="120" cy="70" r="42" fill="url(#ai-core)" />
            <circle
              cx="120"
              cy="70"
              r="22"
              fill="#0A0F1E"
              stroke="#00C2FF"
              strokeWidth="1.2"
              className="signal-glow"
            />
            <text
              x="120"
              y="66"
              textAnchor="middle"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              fill="#00C2FF"
              letterSpacing="1.5"
            >
              CLAUDE
            </text>
            <text
              x="120"
              y="78"
              textAnchor="middle"
              fontSize="7"
              fontFamily="JetBrains Mono, monospace"
              fill="#94A3B8"
            >
              sonnet-4
            </text>

            {/* outbound signal beam */}
            <path
              d="M 142 70 C 180 70, 200 70, 240 70"
              stroke="url(#out-grad)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="6 4"
              className="flow-dash"
            />

            {/* pulsing arrow head */}
            <polygon
              points="232,66 240,70 232,74"
              fill="#34D399"
              className="pulse-dot"
            />
          </svg>
        </div>

        {/* ── Right: signal output card ─────────────────────────────── */}
        <div className="col-span-4">
          <div
            className="rounded-xl p-3 gradient-border"
            style={{ minHeight: 120 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                AI Signal
              </span>
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-display" style={{ color: '#34D399' }}>
                ↑
              </span>
              <span
                className="font-display text-xl"
                style={{ color: '#34D399' }}
              >
                BULLISH
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mb-2">
              <span>Confidence</span>
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${78 + Math.round(jitter(0) * 8)}%`,
                    background: 'linear-gradient(90deg, #00C2FF, #34D399)',
                  }}
                />
              </div>
              <span className="text-slate-300 tabular-nums">
                {78 + Math.round(jitter(0) * 8)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              IBIT leads $412M of net creations; breadth across 4 funds flags
              renewed institutional demand.
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom strip: mini live meta ─────────────────────────────── */}
      <div
        style={{ borderTop: '1px solid var(--brand-border)' }}
        className="mt-4 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500"
      >
        <div className="flex items-center gap-1.5">
          <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          <span>Live · sample data</span>
        </div>
        <div className="flex items-center gap-3">
          <span>lat <span className="text-slate-300">1.8s</span></span>
          <span>funds <span className="text-slate-300">12</span></span>
          <span className="hidden sm:inline">model <span className="text-slate-300">sonnet-4</span></span>
        </div>
      </div>
    </div>
  );
}
