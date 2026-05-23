import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Nav, Footer } from '../components/Nav';
import { HeroVisualizer } from '../components/HeroVisualizer';

// ── Shared animation variants ─────────────────────────────────────────────────
// Note: ease must be a named Easing string (not number[]) for framer-motion v11 strict types.
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut' as const, delay: i * 0.09 },
  }),
};

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    num: '01',
    icon: '⬡',
    title: 'Institutional Data',
    desc: 'Live BTC & ETH spot ETF flows from BlackRock, Fidelity, Grayscale, and 9 more funds — continuously refreshed via SoSoValue.',
    color: '#0057FF',
    glow: 'rgba(0,87,255,0.15)',
  },
  {
    num: '02',
    icon: '✦',
    title: 'Claude AI Signals',
    desc: 'Synthesizes ETF flows + breaking news into directional signals with confidence scores, factor weights, TP/SL levels, and risk warnings.',
    color: '#00C2FF',
    glow: 'rgba(0,194,255,0.15)',
  },
  {
    num: '03',
    icon: '⚡',
    title: 'On-Chain Execution',
    desc: 'Sign and submit spot orders on SoDEX testnet via EIP712. Full risk acknowledgment, testnet-only — zero real capital at risk.',
    color: '#34D399',
    glow: 'rgba(52,211,153,0.15)',
  },
];

const STATS = [
  { value: '$53B+', label: 'BTC ETF Net Assets' },
  { value: '12',    label: 'Funds Tracked' },
  { value: '<2s',   label: 'Signal Generation' },
  { value: '100%',  label: 'Testnet Safe' },
];

const TECH = [
  { name: 'SoSoValue',  sub: 'ETF Data API',     color: '#7C3AED' },
  { name: 'Claude AI',  sub: 'Signal Engine',     color: '#00C2FF' },
  { name: 'SoDEX',      sub: 'Testnet Exchange',  color: '#34D399' },
  { name: 'ValueChain', sub: 'L1 Network',        color: '#F59E0B' },
  { name: 'EIP-712',    sub: 'Typed Signing',     color: '#94A3B8' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--brand-dark)' }}>
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-16 pb-32 lg:pb-40 min-h-[90vh] flex items-center">

        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="orb-a absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #0057FF 0%, transparent 65%)', filter: 'blur(80px)' }}
          />
          <div
            className="orb-b absolute -bottom-32 right-0 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #00C2FF 0%, transparent 65%)', filter: 'blur(80px)' }}
          />
          <div
            className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)', filter: 'blur(60px)' }}
          />

          {/* Fine grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
            <defs>
              <pattern id="lp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00C2FF" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lp-grid)" />
          </svg>

          {/* Diagonal accent line */}
          <div
            className="absolute top-0 right-1/3 w-px h-full opacity-10"
            style={{ background: 'linear-gradient(to bottom, transparent, #00C2FF 30%, #0057FF 70%, transparent)' }}
          />
        </div>

        {/* Two-column layout */}
        <div className="relative max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* ── Left: text + CTAs ──────────────────────────────────────────── */}
          <div className="flex flex-col items-start">

            {/* Buildathon badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 slide-up"
              style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,194,255,0.3)' }}
            >
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              <span
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: 'var(--brand-accent)' }}
              >
                SoSoValue Buildathon 2026 · Wave 2
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-display text-white leading-[0.95] mb-7 slide-up"
              style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', animationDelay: '0.08s' }}
            >
              Read the
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #00C2FF 0%, #0057FF 45%, #A78BFA 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                market.
              </span>
              <br />
              Trade with
              <br />
              <em style={{ color: 'var(--brand-accent)', fontStyle: 'italic' }}>conviction.</em>
            </h1>

            {/* Sub-heading */}
            <p
              className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed slide-up"
              style={{ animationDelay: '0.16s' }}
            >
              ETFSignal AI turns institutional Bitcoin & Ethereum ETF flows into{' '}
              <span className="text-white font-medium">plain-English signals with factor weights</span>{' '}
              — then lets you execute directly on{' '}
              <span style={{ color: 'var(--brand-accent)' }}>SoDEX testnet</span>.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-3 mb-12 slide-up"
              style={{ animationDelay: '0.24s' }}
            >
              <Link
                to="/app"
                className="group px-8 py-4 rounded-xl text-white font-semibold text-base transition-all hover:scale-[1.03] hover:opacity-95 inline-flex items-center justify-center gap-2.5"
                style={{
                  background: 'linear-gradient(135deg, #0057FF, #00C2FF)',
                  boxShadow: '0 8px 32px rgba(0,87,255,0.4)',
                }}
              >
                Launch Dashboard
                <span className="transition-transform group-hover:translate-x-0.5 text-lg">→</span>
              </Link>
              <Link
                to="/how-it-works"
                className="px-8 py-4 rounded-xl text-slate-300 font-semibold text-base transition-all hover:bg-white/5 hover:text-white inline-flex items-center justify-center gap-2"
                style={{ border: '1px solid var(--brand-border)' }}
              >
                How It Works
              </Link>
            </div>

            {/* Trust badges */}
            <div
              className="flex flex-wrap items-center gap-3 slide-up"
              style={{ animationDelay: '0.32s' }}
            >
              {[
                { dot: '#10B981', label: 'SoSoValue ETF data' },
                { dot: '#00C2FF', label: 'Claude AI powered' },
                { dot: '#A78BFA', label: 'EIP-712 signed orders' },
                { dot: '#F59E0B', label: 'Testnet only' },
              ].map(b => (
                <div
                  key={b.label}
                  className="flex items-center gap-1.5 text-xs text-slate-500 font-mono"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b.dot }} />
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: 3D floating hero card ──────────────────────────────── */}
          <div
            className="w-full slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            <HeroVisualizer />
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-4"
              style={{ color: 'var(--brand-accent)' }}
            >
              The complete stack
            </p>
            <h2 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">
              From data overload to{' '}
              <em style={{ color: 'var(--brand-accent)' }}>decisive action.</em>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Three pillars. One workflow. No noise.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.num}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl p-8 hover:border-white/15 transition-colors group relative overflow-hidden"
                style={{
                  background: 'var(--brand-card)',
                  border: '1px solid var(--brand-border)',
                }}
              >
                {/* Glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 20% 20%, ${f.glow}, transparent 70%)` }}
                />

                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-xs tracking-widest" style={{ color: f.color }}>
                      / {f.num}
                    </span>
                    <span className="text-2xl" style={{ color: f.color }}>{f.icon}</span>
                  </div>
                  <h3 className="font-display text-white text-2xl mb-3">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-dark)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                className="text-center"
              >
                <div
                  className="font-display text-4xl md:text-5xl mb-2"
                  style={{
                    background: 'linear-gradient(135deg, #00C2FF, #0057FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {s.value}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK / POWERED BY ─────────────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-slate-600 uppercase tracking-widest mb-10 font-mono">
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {TECH.map(t => (
              <div
                key={t.name}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all hover:border-white/15 hover:scale-[1.03]"
                style={{
                  background: 'var(--brand-card)',
                  border: '1px solid var(--brand-border)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }}
                />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  <div className="text-slate-500 text-[10px] font-mono">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIGNAL BREAKDOWN PREVIEW ────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: 'var(--brand-dark)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
            >
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--brand-accent)' }}>
                New in Wave 2
              </p>
              <h2 className="font-display text-white text-3xl md:text-4xl mb-5 leading-tight">
                Transparent signal logic.{' '}
                <em style={{ color: 'var(--brand-accent)' }}>See the weights.</em>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Every AI signal now exposes its decision breakdown — how much ETF inflows,
                cumulative flow trends, news sentiment, and fund concentration each
                contributed to the call. No more black-box AI.
              </p>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--brand-accent)' }}
              >
                See it live →
              </Link>
            </motion.div>

            {/* Mini signal breakdown preview */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              custom={1}
              variants={fadeUp}
              className="rounded-2xl p-6"
              style={{
                background: 'var(--brand-card)',
                border: '1px solid var(--brand-border)',
              }}
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4">
                ◈ Signal Breakdown — Example
              </div>
              {[
                { factor: 'ETF Daily Inflow',      weight: 38, signal: 'positive' as const, color: '#34D399' },
                { factor: 'Cumulative Flow Trend', weight: 28, signal: 'positive' as const, color: '#34D399' },
                { factor: 'News Sentiment',        weight: 22, signal: 'neutral'  as const, color: '#94A3B8' },
                { factor: 'Fund Concentration',    weight: 12, signal: 'negative' as const, color: '#F87171' },
              ].map((w, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-400 font-mono">{w.factor}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
                        style={{
                          color: w.color,
                          background: `${w.color}18`,
                          border: `1px solid ${w.color}30`,
                        }}
                      >
                        {w.signal}
                      </span>
                      <span className="text-[11px] font-mono font-bold" style={{ color: w.color }}>
                        {w.weight}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${w.weight}%`,
                        background: w.color,
                        opacity: 0.75,
                        transition: 'width 1s ease-out',
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="text-[10px] font-mono text-slate-600">Powered by Claude AI</div>
                <div
                  className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
                >
                  ↑ BULLISH · 82%
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-28 relative overflow-hidden" style={{ background: 'var(--brand-panel)' }}>
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,87,255,0.18) 0%, transparent 65%)' }}
          aria-hidden
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-display text-white text-4xl md:text-6xl mb-6 leading-tight">
            Stop guessing.{' '}
            <em style={{ color: 'var(--brand-accent)' }}>Start signaling.</em>
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
            Open the dashboard. Connect your wallet. Generate your first AI signal in under 30 seconds.
          </p>
          <Link
            to="/app"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.04] signal-glow"
            style={{
              background: 'linear-gradient(135deg, #0057FF, #00C2FF)',
              boxShadow: '0 12px 40px rgba(0,87,255,0.45)',
            }}
          >
            Launch ETFSignal AI
            <span className="text-2xl">→</span>
          </Link>
          <p className="mt-6 text-xs text-slate-600 font-mono">
            Testnet only · No real funds required · SoDEX demo environment
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
