import { Link } from 'react-router-dom';
import { Nav, Footer } from '../components/Nav';

export function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Ingest',
      subtitle: 'Live institutional data',
      desc: 'ETFSignal AI fetches real-time data from the SoSoValue API: BTC and ETH spot ETF metrics including daily inflows, net assets, cumulative flows, and per-fund breakdowns from BlackRock, Fidelity, Grayscale, and 8 other issuers.',
      tech: ['SoSoValue REST API', 'Polling every 5 minutes', 'BTC + ETH spot ETFs'],
      color: '#0057FF',
    },
    {
      num: '02',
      title: 'Enrich',
      subtitle: 'Categorized news context',
      desc: 'Live news feed pulled from the same SoSoValue API — filtered by category (on-chain events, institutional reports, price alerts, research, official tweets) and matched to the relevant currency.',
      tech: ['News feed endpoint', '9 category types', 'Multilingual content'],
      color: '#00C2FF',
    },
    {
      num: '03',
      title: 'Analyze',
      subtitle: 'AI synthesis',
      desc: 'Claude AI receives a structured payload of ETF flow data + recent news headlines. It analyzes the institutional money movement patterns, cross-references news context, and synthesizes everything into a directional signal.',
      tech: ['Claude Sonnet 4', 'Structured JSON output', 'Hidden via serverless'],
      color: '#A78BFA',
    },
    {
      num: '04',
      title: 'Signal',
      subtitle: 'Actionable insight',
      desc: 'The dashboard displays the signal: BULLISH / BEARISH / NEUTRAL with a confidence score (0–100%), a punchy headline, key factors, a specific trade idea, and an explicit risk warning.',
      tech: ['Direction + confidence', 'Key factors breakdown', 'Risk thesis included'],
      color: '#34D399',
    },
    {
      num: '05',
      title: 'Execute',
      subtitle: 'On-chain confirmation',
      desc: 'User reviews the suggested order, acknowledges the risk warning explicitly, then confirms. The order is signed via EIP712 with their wallet and submitted to SoDEX testnet — no funds at risk during the buildathon.',
      tech: ['SoDEX Testnet API', 'EIP712 typed signing', 'Risk acknowledgment'],
      color: '#F59E0B',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--brand-dark)' }}>
      <Nav />

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-16 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top, #0057FF 0%, transparent 60%)' }}
        />

        <div className="relative max-w-4xl mx-auto">
          <p style={{ color: 'var(--brand-accent)' }} className="text-sm font-mono uppercase tracking-widest mb-4">
            The Pipeline
          </p>
          <h1 className="font-display text-white text-5xl md:text-7xl mb-6 leading-tight">
            Five steps. <em style={{ color: 'var(--brand-accent)' }}>Zero noise.</em>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Every signal in ETFSignal AI follows the same disciplined workflow —
            from raw institutional data to a confirmed on-chain trade.
          </p>
        </div>
      </section>

      {/* ─── STEPS ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto space-y-6">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="grid md:grid-cols-12 gap-6 items-start slide-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {/* Number column */}
              <div className="md:col-span-2">
                <div
                  className="font-display text-7xl md:text-8xl"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}, ${step.color}40)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: '1',
                  }}
                >
                  {step.num}
                </div>
              </div>

              {/* Content column */}
              <div
                style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                className="md:col-span-10 rounded-2xl p-8 hover:border-white/20 transition-all"
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                  <div>
                    <h2 className="font-display text-white text-3xl">{step.title}</h2>
                    <p className="text-sm" style={{ color: step.color }}>{step.subtitle}</p>
                  </div>
                </div>

                <p className="text-slate-300 leading-relaxed mb-5">{step.desc}</p>

                <div className="flex flex-wrap gap-2">
                  {step.tech.map(t => (
                    <span
                      key={t}
                      style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}
                      className="text-xs px-3 py-1 rounded-full font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DATA SOURCES ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--brand-panel)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-white text-4xl mb-4">Built on real data, real APIs.</h2>
            <p className="text-slate-400">Every integration is genuine — no mockups in production.</p>
          </div>

          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="rounded-2xl overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead style={{ background: 'rgba(0,87,255,0.05)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Endpoint</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['SoSoValue', '/openapi/v2/etf/currentEtfDataMetrics', 'Live BTC/ETH ETF flow metrics'],
                  ['SoSoValue', '/api/v1/news/featured', 'Categorized crypto news feed'],
                  ['Anthropic', 'claude-sonnet-4-20250514', 'Market signal synthesis'],
                  ['SoDEX Testnet', 'testnet-gw.sodex.dev/api/v1/spot', 'EIP712-signed order placement'],
                  ['SoDEX Testnet', 'wss://testnet-gw.sodex.dev/ws/spot', 'Real-time price feed (Wave 2)'],
                ].map(([src, ep, purpose], i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--brand-border)' }}>
                    <td className="px-6 py-4 font-semibold text-white">{src}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{ep}</td>
                    <td className="px-6 py-4 text-slate-300">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <h2 className="font-display text-white text-4xl md:text-5xl mb-6">
          Ready to see it in action?
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
