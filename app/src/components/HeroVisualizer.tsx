import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 3D perspective-tilted dashboard card for the landing hero.
 * Tracks mouse position to apply a subtle rotateX/Y tilt.
 * Floating stat chips appear at different z-depths for depth.
 */
export function HeroVisualizer() {
  const [tick, setTick]       = useState(0);
  const [mouse, setMouse]     = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left) / rect.width  - 0.5,
      y: (e.clientY - rect.top)  / rect.height - 0.5,
    });
  }, []);

  // Resting angle: slight top-left perspective. Mouse adds ±10°.
  const rx = hovered ? -mouse.y * 14 + 8  : 8;
  const ry = hovered ? mouse.x  * 14 - 4  : -4;

  const funds = [
    { label: 'IBIT', base: 312, vari: 18, color: '#00FFA7' },
    { label: 'FBTC', base: 142, vari: 14, color: '#00CC88' },
    { label: 'ARKB', base:  48, vari:  8, color: '#A78BFA' },
    { label: 'BITB', base:  22, vari:  6, color: '#34D399' },
  ];
  const jitter = (i: number) => Math.sin((tick + i * 1.3) * 0.9) * 0.5 + 0.5;

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ perspective: '1200px', perspectiveOrigin: '50% 40%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMouse({ x: 0, y: 0 }); }}
    >
      {/* ── Floating stat chips (above card in Z-space) ───────────────── */}

      {/* Top-right: Daily inflow */}
      <div
        className="absolute -top-5 -right-4 z-20 chip-float-a"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(52,211,153,0.35))' }}
      >
        <div
          className="rounded-2xl px-4 py-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.08))',
            border: '1px solid rgba(52,211,153,0.45)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="text-[9px] text-slate-400 font-mono tracking-widest mb-0.5">DAILY INFLOW</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#34D399' }}>+$412M</div>
        </div>
      </div>

      {/* Bottom-left: Confidence — teal */}
      <div
        className="absolute -bottom-5 -left-4 z-20 chip-float-b"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(0,255,167,0.28))' }}
      >
        <div
          className="rounded-2xl px-4 py-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,167,0.14), rgba(0,255,167,0.06))',
            border: '1px solid rgba(0,255,167,0.35)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="text-[9px] text-slate-400 font-mono tracking-widest mb-0.5">AI CONFIDENCE</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#00FFA7' }}>82%</div>
        </div>
      </div>

      {/* Mid-right: Funds tracked */}
      <div
        className="absolute top-1/3 -right-10 z-20 chip-float-b hidden xl:block"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(167,139,250,0.3))' }}
      >
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.06))',
            border: '1px solid rgba(167,139,250,0.35)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="text-[9px] text-slate-400 font-mono tracking-widest mb-0.5">FUNDS</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#A78BFA' }}>12</div>
        </div>
      </div>

      {/* ── Soft glow reflection below card ──────────────────────────────── */}
      <div
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,255,167,0.2) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* ── Main 3D card ──────────────────────────────────────────────────── */}
      <div
        className={hovered ? '' : 'hero-float'}
        style={{
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          transition: hovered ? 'transform 0.08s ease-out' : 'transform 0.7s ease-out',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          borderRadius: '1.25rem',
          background: 'linear-gradient(145deg, rgba(4,16,27,0.97) 0%, rgba(6,8,11,0.95) 100%)',
          border: '1px solid rgba(0,255,167,0.12)',
          boxShadow: `
            0 0 0 1px rgba(0,255,167,0.05),
            0 30px 80px rgba(0,0,0,0.7),
            0 0 100px rgba(0,255,167,0.06),
            inset 0 1px 0 rgba(255,255,255,0.04)
          `,
        }}
      >
        {/* Subtle grid bg */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]"
          style={{ borderRadius: '1.25rem' }}
          aria-hidden
        >
          <defs>
            <pattern id="hv-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#00FFA7" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hv-grid)" />
        </svg>

        {/* Scan line effect */}
        <div
          className="scan-line absolute left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,255,167,0.4), transparent)',
            zIndex: 1,
          }}
        />

        <div className="relative p-5" style={{ zIndex: 2 }}>
          {/* Window chrome */}
          <div
            className="flex items-center justify-between mb-4 pb-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
            </div>
            <span className="text-[9px] font-mono text-slate-500 tracking-widest uppercase">
              ETFSignal AI · Live Feed
            </span>
            <div className="flex items-center gap-1.5">
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              <span className="text-[9px] font-mono text-slate-500">LIVE</span>
            </div>
          </div>

          {/* Content: 3 columns */}
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Left: fund flows */}
            <div className="col-span-4 space-y-2.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">
                Institutional ETF Flows
              </div>
              {funds.map((f, i) => {
                const amt = f.base + Math.round(f.vari * (jitter(i) * 2 - 1));
                const pct = Math.min(100, (Math.abs(amt) / 350) * 100);
                return (
                  <div key={f.label} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="w-8 text-slate-300 shrink-0">{f.label}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%`, background: f.color, boxShadow: `0 0 8px ${f.color}88` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums shrink-0" style={{ color: '#34D399' }}>
                      +{amt}M
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Middle: animated SVG flow */}
            <div className="col-span-4 relative h-32">
              <svg viewBox="0 0 240 140" className="w-full h-full">
                <defs>
                  <linearGradient id="lg-in" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%"   stopColor="#00FFA7" stopOpacity="0" />
                    <stop offset="60%"  stopColor="#00FFA7" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#00CC88" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="lg-out" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%"   stopColor="#A78BFA" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id="rg-core" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#00FFA7" stopOpacity="0.35" />
                    <stop offset="65%"  stopColor="#00CC88" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#00CC88" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {[28, 56, 84, 112].map((y, i) => (
                  <path
                    key={i}
                    d={`M 0 ${y} C 60 ${y}, 80 70, 110 70`}
                    stroke="url(#lg-in)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeDasharray="4 6"
                    className="flow-dash"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
                <circle cx="120" cy="70" r="42" fill="url(#rg-core)" />
                <circle cx="120" cy="70" r="23" fill="#04101B" stroke="#00FFA7" strokeWidth="1.2" className="signal-glow" />
                <text x="120" y="67" textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono,monospace" fill="#00FFA7" letterSpacing="1.5">CLAUDE</text>
                <text x="120" y="78" textAnchor="middle" fontSize="6.5" fontFamily="JetBrains Mono,monospace" fill="#64748B">sonnet-4</text>
                <path d="M 143 70 C 185 70, 205 70, 240 70" stroke="url(#lg-out)" strokeWidth="2" fill="none" strokeDasharray="6 4" className="flow-dash" />
                <polygon points="232,66 240,70 232,74" fill="#34D399" className="pulse-dot" />
              </svg>
            </div>

            {/* Right: signal output */}
            <div className="col-span-4">
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'rgba(52,211,153,0.07)',
                  border: '1px solid rgba(52,211,153,0.22)',
                  boxShadow: '0 0 24px rgba(52,211,153,0.08)',
                }}
              >
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Signal Output</div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowUp size={18} style={{ color: '#34D399' }} className="shrink-0" />
                  <span className="text-lg font-display leading-none" style={{ color: '#34D399' }}>BULLISH</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mb-2">
                  <span>Confidence</span>
                  <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${78 + Math.round(jitter(0) * 8)}%`,
                        background: 'linear-gradient(90deg,#00FFA7,#34D399)',
                      }}
                    />
                  </div>
                  <span className="text-slate-200 tabular-nums">{78 + Math.round(jitter(0) * 8)}%</span>
                </div>
                <p className="text-[9px] text-slate-400 leading-snug">
                  IBIT leads $412M of net creations — institutional breadth signals renewed demand.
                </p>

                {/* Mini TP/SL */}
                <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                  <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div className="text-[8px] text-green-500 font-mono">TP</div>
                    <div className="text-[10px] font-mono font-bold text-green-300">$102k</div>
                  </div>
                  <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <div className="text-[8px] text-red-400 font-mono">SL</div>
                    <div className="text-[10px] font-mono font-bold text-red-300">$90k</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div
            className="mt-4 pt-3 flex items-center justify-between text-[9px] font-mono text-slate-600"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center gap-1.5">
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              <span>Live · SoSoValue API</span>
            </div>
            <div className="flex items-center gap-3">
              <span>lat <span className="text-slate-400">1.8s</span></span>
              <span>funds <span className="text-slate-400">12</span></span>
              <span className="hidden sm:inline">model <span className="text-slate-400">sonnet-4</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
