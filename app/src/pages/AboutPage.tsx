import { Link } from 'react-router-dom';
import { Nav, Footer } from '../components/Nav';

export function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-dark)' }}>
      <Nav />

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, #00C2FF 0%, transparent 60%)' }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono uppercase tracking-widest mb-4">
            One person · Real product
          </p>
          <h1 className="font-display text-white text-5xl md:text-7xl mb-6 leading-tight">
            Built solo. <em style={{ color: 'var(--brand-accent)' }}>Built fast.</em>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            ETFSignal AI is a one-person submission to the SoSoValue Buildathon 2026.
            Designed, coded, and shipped end-to-end by a single builder.
          </p>
        </div>
      </section>

      {/* ─── BUILDER ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-12">
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="max-w-4xl mx-auto rounded-3xl p-10 md:p-12"
        >
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div
              style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
              className="w-24 h-24 rounded-2xl flex items-center justify-center text-white font-display text-4xl shrink-0"
            >
              M
            </div>

            <div className="flex-1">
              <h2 className="font-display text-white text-3xl mb-1">MrG</h2>
              <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono mb-6">
                Independent Builder · Solo Submission
              </p>

              <p className="text-slate-300 leading-relaxed mb-6">
                Independent developer focused on on-chain finance, privacy infrastructure, and AI-augmented tooling. Believes the best products come from one person who deeply understands both the user and the stack — not committees.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'GitHub', href: 'https://github.com/girume1', icon: '⌬' },
                  { label: 'X / Twitter', href: 'https://x.com/theinvisivle', icon: '𝕏' },
                  { label: 'Akindo', href: 'https://app.akindo.io/users/MrG', icon: '◆' },
                  { label: 'Discord', href: '#', icon: '◉', value: 'mrgt_07' },
                ].map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'rgba(0,194,255,0.05)', border: '1px solid var(--brand-border)' }}
                    className="px-3 py-2.5 rounded-lg hover:border-blue-500/50 transition-all"
                  >
                    <div className="text-xs text-slate-500">{link.icon} {link.label}</div>
                    <div className="text-sm text-white truncate">{link.value || 'Visit →'}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PHILOSOPHY ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono uppercase tracking-widest mb-4">
            Why this product
          </p>
          <h2 className="font-display text-white text-4xl md:text-5xl mb-8 leading-tight">
            Most traders don't need <em style={{ color: 'var(--brand-accent)' }}>more data</em>.
            They need <em style={{ color: 'var(--brand-accent)' }}>better signals</em>.
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed mb-6">
            Crypto markets generate enormous noise — ETF flows, on-chain events,
            news cycles, institutional moves. No single tool connects all of it,
            explains what it means in plain English, and lets you act on it.
          </p>
          <p className="text-lg text-slate-400 leading-relaxed">
            ETFSignal AI closes that gap. It's the dashboard a one-person trader
            would actually use — built by a one-person team.
          </p>
        </div>
      </section>

      {/* ─── BUILDATHON CONTEXT ─────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-4xl mx-auto">
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="rounded-2xl p-8 md:p-10"
          >
            <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono uppercase tracking-widest mb-3">
              SoSoValue Buildathon 2026
            </p>
            <h3 className="font-display text-white text-3xl mb-6">Wave-by-wave shipping</h3>

            <div className="space-y-4">
              {[
                { wave: 'Wave 1', status: '✓', state: 'Shipped', label: 'Concept + Full Scaffold + APIs Integrated', color: '#34D399' },
                { wave: 'Wave 2', status: '◯', state: 'Next', label: 'Real-time WebSocket · Historical charts · Polished trade flow', color: '#00C2FF' },
                { wave: 'Wave 3', status: '◯', state: 'Planned', label: 'Portfolio tracker · Copy-trading · Final demo polish', color: '#0057FF' },
              ].map(w => (
                <div
                  key={w.wave}
                  style={{ borderLeft: `3px solid ${w.color}` }}
                  className="pl-4 py-2"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span style={{ color: w.color }} className="font-mono text-lg">{w.status}</span>
                    <span className="font-display text-white text-lg">{w.wave}</span>
                    <span style={{ color: w.color, background: `${w.color}15`, border: `1px solid ${w.color}30` }} className="text-xs px-2 py-0.5 rounded font-mono">
                      {w.state}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 ml-7">{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <h2 className="font-display text-white text-4xl md:text-5xl mb-6">
          Want to try it yourself?
        </h2>
        <Link
          to="/app"
          style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
          className="inline-flex items-center gap-3 px-10 py-5 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105"
        >
          Launch the Dashboard
          <span className="text-2xl">→</span>
        </Link>
      </section>

      <Footer />
    </div>
  );
}
