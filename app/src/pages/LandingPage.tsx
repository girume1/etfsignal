import { Link } from 'react-router-dom';
import { Nav, Footer } from '../components/Nav';
import { HeroVisualizer } from '../components/HeroVisualizer';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-dark)' }}>
      <Nav />

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-32">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, #0057FF 0%, transparent 70%)', filter: 'blur(60px)' }}
          />
          <div
            className="absolute top-20 right-0 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #00C2FF 0%, transparent 70%)', filter: 'blur(60px)' }}
          />
          <div
            className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #00C2FF 0%, transparent 70%)', filter: 'blur(80px)' }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          {/* Buildathon Badge */}
          <div
            style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,194,255,0.3)' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 slide-up"
          >
            <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--brand-accent)' }}>
              SoSoValue Buildathon 2026 · Wave 1 Live
            </span>
          </div>

          <h1
            className="font-display text-white leading-none mb-6 slide-up"
            style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', animationDelay: '0.1s' }}
          >
            Read the
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #00C2FF 0%, #0057FF 50%, #00C2FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              market
            </span>
            <span className="text-slate-400">.</span> Trade
            <br />
            with <em style={{ color: 'var(--brand-accent)' }}>conviction</em>.
          </h1>

          <p
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            ETFSignal AI turns institutional Bitcoin & Ethereum ETF flows
            into <span className="text-white">plain-English signals</span> —
            then lets you execute directly on{' '}
            <span style={{ color: 'var(--brand-accent)' }}>SoDEX testnet</span>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center slide-up" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/app"
              style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
              className="px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105 hover:opacity-90 inline-flex items-center justify-center gap-2"
            >
              Launch Dashboard
              <span className="text-xl">→</span>
            </Link>
            <Link
              to="/how-it-works"
              style={{ border: '1px solid var(--brand-border)' }}
              className="px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all hover:bg-white/5 inline-flex items-center justify-center gap-2"
            >
              See How It Works
            </Link>
          </div>

          {/* Animated pipeline visualization */}
          <div className="mt-16">
            <HeroVisualizer />
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono uppercase tracking-widest mb-4">
              Built for one-person traders
            </p>
            <h2 className="font-display text-white text-4xl md:text-5xl mb-4">
              From data overload to <em style={{ color: 'var(--brand-accent)' }}>decisive action</em>.
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Three pillars. One workflow. Zero noise.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Institutional Data',
                desc: 'Live BTC & ETH spot ETF flows from BlackRock, Fidelity, Grayscale, and 8 more funds — refreshed continuously.',
                color: '#0057FF',
              },
              {
                num: '02',
                title: 'AI-Powered Signals',
                desc: 'Claude AI synthesizes flows + news into directional signals with confidence scores, key factors, and risk warnings.',
                color: '#00C2FF',
              },
              {
                num: '03',
                title: 'On-Chain Execution',
                desc: 'Sign and submit spot orders directly to SoDEX testnet via EIP712 — full risk acknowledgment built in.',
                color: '#34D399',
              },
            ].map((f, i) => (
              <div
                key={f.num}
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)', animationDelay: `${i * 0.1}s` }}
                className="rounded-2xl p-8 slide-up hover:border-white/20 transition-all group"
              >
                <div
                  className="font-mono text-sm mb-6 tracking-wider"
                  style={{ color: f.color }}
                >
                  / {f.num}
                </div>
                <h3 className="font-display text-white text-2xl mb-4">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS / DATA STRIP ─────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-dark)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '$53B+', label: 'BTC ETF Net Assets' },
              { value: '12+', label: 'Funds Tracked' },
              { value: '<2s', label: 'Signal Generation' },
              { value: '0%', label: 'Slippage on Testnet' },
            ].map((s, i) => (
              <div key={s.label} className="text-center slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div
                  className="font-display text-4xl md:text-5xl mb-2"
                  style={{
                    background: 'linear-gradient(135deg, #00C2FF, #0057FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {s.value}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BUILT WITH ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-slate-500 uppercase tracking-widest mb-8">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {['SoSoValue API', 'SoDEX Testnet', 'ValueChain L1', 'Anthropic Claude', 'EIP712'].map(name => (
              <div key={name} className="font-display text-2xl text-slate-400 hover:text-white transition-colors">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 relative overflow-hidden" style={{ background: 'var(--brand-dark)' }}>
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,194,255,0.15) 0%, transparent 60%)' }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-display text-white text-4xl md:text-6xl mb-6 leading-tight">
            Stop guessing. <em style={{ color: 'var(--brand-accent)' }}>Start signaling.</em>
          </h2>
          <p className="text-lg text-slate-400 mb-10">
            Open the dashboard. Connect your wallet. Generate your first AI signal in 30 seconds.
          </p>
          <Link
            to="/app"
            style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105 signal-glow"
          >
            Launch ETFSignal AI
            <span className="text-2xl">→</span>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
