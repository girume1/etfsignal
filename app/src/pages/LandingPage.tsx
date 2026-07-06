import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hexagon, Sparkles, Zap, ArrowRight, Star, ArrowUp, Check, TrendingUp, Shield, ArrowLeftRight } from 'lucide-react';
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
    icon: Hexagon,
    title: 'Institutional Data',
    desc: 'Live BTC & ETH spot ETF flows from BlackRock, Fidelity, Grayscale, and 9 more funds — continuously refreshed via SoSoValue.',
    color: '#00FFA7',
    glow: 'rgba(0,255,167,0.12)',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'Claude AI Signals',
    desc: 'Synthesizes ETF flows + breaking news into directional signals with confidence scores, factor weights, TP/SL levels, and risk warnings.',
    color: '#00FFA7',
    glow: 'rgba(0,255,167,0.12)',
  },
  {
    num: '03',
    icon: Zap,
    title: 'Risk-Managed Execution',
    desc: 'Half-Kelly position sizing recommends your size before you trade. Sign and submit spot or leveraged perps orders on SoDEX testnet via EIP-712 — testnet-only, zero real capital at risk.',
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
  { name: 'Claude AI',  sub: 'Signal Engine',     color: '#00FFA7' },
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
            style={{ background: 'radial-gradient(circle, rgba(0,255,167,0.3) 0%, transparent 65%)', filter: 'blur(80px)' }}
          />
          <div
            className="orb-b absolute -bottom-32 right-0 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(0,255,167,0.25) 0%, transparent 65%)', filter: 'blur(80px)' }}
          />
          <div
            className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(0,255,167,0.25) 0%, transparent 70%)', filter: 'blur(60px)' }}
          />

          {/* Fine grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
            <defs>
              <pattern id="lp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,167,0.35)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lp-grid)" />
          </svg>

          {/* Diagonal accent line */}
          <div
            className="absolute top-0 right-1/3 w-px h-full opacity-10"
            style={{ background: 'linear-gradient(to bottom, transparent, #00FFA7 30%, #00FFA7 70%, transparent)' }}
          />
        </div>

        {/* Two-column layout */}
        <div className="relative max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* ── Left: text + CTAs ──────────────────────────────────────────── */}
          <div className="flex flex-col items-start">

            {/* Buildathon badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 slide-up"
              style={{ background: 'rgba(0,255,167,0.07)', border: '1px solid rgba(0,255,167,0.25)' }}
            >
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              <span
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: 'var(--brand-accent)' }}
              >
                SoSoValue Buildathon 2026 · Wave 3
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
                  background: 'linear-gradient(135deg, #00FFA7 0%, #00FFA7 45%, #00FFA7 100%)',
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
                  background: '#FF7637',
                  boxShadow: '0 8px 32px rgba(255,118,55,0.4)',
                }}
              >
                Launch Dashboard
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5 shrink-0" />
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
                { dot: '#00FFA7', label: 'Claude AI powered' },
                { dot: '#00FFA7', label: 'EIP-712 signed orders' },
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
                    <f.icon size={24} style={{ color: f.color }} />
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
                    background: '#00FFA7',
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
                Since Wave 2
              </p>
              <h2 className="font-display text-white text-3xl md:text-4xl mb-5 leading-tight">
                Transparent signal logic.{' '}
                <em style={{ color: 'var(--brand-accent)' }}>See the weights.</em>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Every AI signal exposes its decision breakdown — how much ETF inflows,
                cumulative flow trends, news sentiment, and fund concentration each
                contributed to the call. No more black-box AI.
              </p>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--brand-accent)' }}
              >
                See it live
                <ArrowRight size={14} className="shrink-0" />
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
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-1">
                <Sparkles size={10} className="shrink-0" />
                Signal Breakdown — Example
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
                  className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
                >
                  <ArrowUp size={11} className="shrink-0" />
                  BULLISH · 82%
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── NEW IN WAVE 3 ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--brand-accent)' }}>
              New in Wave 3
            </p>
            <h2 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">
              Real outcomes.{' '}
              <em style={{ color: 'var(--brand-accent)' }}>Not estimates.</em>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Backtesting, risk sizing, and leveraged execution — all checked against what actually happened, not what should have.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: 'Real Backtesting',
                desc: 'Hit rate, average P&L, and max drawdown computed from actual TP/SL outcomes against real Binance hourly candles — replacing Wave 2\'s simulated tracking.',
              },
              {
                icon: Shield,
                title: 'Half-Kelly Risk Manager',
                desc: 'Recommended position size from your balance, the signal\'s confidence, and its TP/SL — with risk-reward and ATR warnings before you ever click submit.',
              },
              {
                icon: ArrowLeftRight,
                title: 'Perps, Long or Short',
                desc: 'Leveraged execution up to each market\'s real max on SoDEX testnet, with TP/SL bracket orders, reduce-only, isolated/cross margin, and a liquidation-price estimate up front — real liquidation status shown after, sourced from SoDEX\'s own record.',
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="rounded-2xl p-8"
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
              >
                <f.icon size={22} style={{ color: 'var(--brand-accent)' }} className="mb-5" />
                <h3 className="font-display text-white text-xl mb-3">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMUNITY VOTES ──────────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-dark)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-4"
              style={{ background: 'rgba(0,255,167,0.08)', border: '1px solid rgba(0,255,167,0.2)', color: '#00FFA7' }}
            >
              <Star size={12} className="shrink-0" />
              SoSoValue Buildathon · Wave 1 &amp; 2 Votes
            </div>
            <h2 className="font-display text-white text-3xl md:text-4xl mb-3">
              What the community said
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Independent reviews from the SoSoValue Buildathon evaluation panel, across both waves.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                handle: '@Davislambo',
                wave: 2,
                stars: 5,
                quote: 'One of the strongest technical deliveries in this round. The full SoDEX EIP-712 spot trading pipeline resolved and real order IDs confirmed — the most thoroughly documented SoDEX integration in wave 2.',
              },
              {
                handle: '@Web3Lord01',
                wave: 2,
                stars: 5,
                quote: 'One of the most polished and complete submissions in this wave. The full signal-to-execution pipeline is genuinely end-to-end and each piece is functional. This is a well-built, honest, and complete product.',
              },
              {
                handle: '@BlessinSum',
                wave: 2,
                stars: 5,
                quote: 'One of the most complete signal-to-execution submissions this wave. The full EIP-712 pipeline on SoDEX testnet is verified — real order IDs returned, signing envelope confirmed, symbolID resolved dynamically at runtime.',
              },
              {
                handle: '@0xmiharbi',
                wave: 1,
                stars: 5,
                quote: 'One of the strongest submissions overall. ETFSignal AI is a polished, well-engineered, and highly usable product with outstanding dashboard quality and UX.',
              },
              {
                handle: '@MuhammadBa_2024',
                wave: 2,
                stars: 5,
                quote: 'This is a top tier Wave 2 execution example with strong system design discipline and one of the clearest "data-to-trade" pipelines in the set.',
              },
              {
                handle: '@SmartCoded',
                wave: 1,
                stars: 4,
                quote: 'Server-side Claude proxy keeping the API key off the browser is exactly right. The sentiment gauge with zone colors makes ETF flow readable to retail.',
              },
            ].map((v, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i * 0.5}
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                className="rounded-xl p-5 flex flex-col gap-3 card-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #00FFA7, #00CC88)', color: '#06080B' }}
                    >
                      {v.handle[1].toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-300">{v.handle}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {Array(5).fill(0).map((_, si) => (
                      <Star key={si} size={12} style={{ color: si < v.stars ? '#00FFA7' : '#334155' }} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed flex-1">"{v.quote}"</p>
                <div
                  className="text-[10px] font-mono px-2 py-1 rounded self-start flex items-center gap-1"
                  style={{ background: 'rgba(0,255,167,0.08)', color: '#00FFA7' }}
                >
                  <Check size={10} className="shrink-0" />
                  Voted · Wave {v.wave}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-28 relative overflow-hidden" style={{ background: 'var(--brand-panel)' }}>
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,167,0.1) 0%, transparent 65%)' }}
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
              background: '#FF7637',
              boxShadow: '0 12px 40px rgba(255,118,55,0.45)',
            }}
          >
            Launch ETFSignal AI
            <ArrowRight size={22} className="shrink-0" />
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
