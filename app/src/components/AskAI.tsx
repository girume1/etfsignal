import { useState, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { EtfData, MarketSignal } from '../types';
import { askFollowUp } from '../services/ai';
import type { ChatTurn } from '../services/ai';
import { AGENT_BRANDING } from '../config/agentBranding';

interface AskAIProps {
  asset: 'BTC' | 'ETH';
  etfData: EtfData | null;
  signal: MarketSignal | null;
}

const STARTERS: Record<'BTC' | 'ETH', string[]> = {
  BTC: [
    'Why is IBIT leading inflows?',
    'What if outflows continue for 3 days?',
    'How do today\'s flows compare to the 14d average?',
  ],
  ETH: [
    'Why are ETH flows weaker than BTC?',
    'What would a staking approval do to ETHA?',
    'Explain the GBTC / ETHE rotation.',
  ],
};

/**
 * Follow-up chat panel. Lets the user ask free-form questions about the
 * current signal or the underlying data — routed through the same
 * /api/analyze serverless function that powers signal synthesis, so the
 * NVIDIA_API_KEY never touches the client.
 */
export function AskAI({ asset, etfData, signal }: AskAIProps) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, loading]);

  async function send(question: string) {
    if (!etfData || !question.trim() || loading) return;
    setError(null);
    setFailedQuestion(null);
    const q = question.trim();
    setInput('');
    setHistory(h => [...h, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const answer = await askFollowUp(asset, etfData, signal, history, q);
      setHistory(h => [...h, { role: 'assistant', content: answer }]);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'The Agent is temporarily unavailable.';
      const friendlyMsg = `${rawMsg} Manual trading and rule-based ETF data remain available.`;
      setError(friendlyMsg);
      setFailedQuestion(q);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl flex flex-col"
    >
      <div
        style={{ borderBottom: '1px solid var(--brand-border)' }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{ background: 'rgba(0,255,167,0.1)', border: '1px solid rgba(0,255,167,0.25)' }}
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          >
            <Sparkles size={12} style={{ color: '#00FFA7' }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white tracking-wide">{AGENT_BRANDING.askTitle}</span>
            <span
              style={{ background: 'rgba(0,255,167,0.1)', color: '#00FFA7', border: '1px solid rgba(0,255,167,0.25)' }}
              className="text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {AGENT_BRANDING.subtitle}
            </span>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => { setHistory([]); setError(null); }}
            className="text-[10px] text-slate-500 hover:text-white font-mono uppercase tracking-wider"
          >
            Reset
          </button>
        )}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
        {history.length === 0 && !loading && (
          <>
            <p className="text-xs text-slate-400 leading-relaxed">
              {AGENT_BRANDING.welcomeMessage}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {STARTERS[asset].map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{ background: 'rgba(0,255,167,0.06)', border: '1px solid rgba(0,255,167,0.18)' }}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:border-cyan-400/40 transition-colors text-left leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {history.map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              style={t.role === 'user'
                ? { background: 'rgba(0,255,167,0.1)', border: '1px solid rgba(0,255,167,0.25)' }
                : { background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}
              className="max-w-[85%] rounded-xl px-3 py-2 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap"
            >
              {t.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}
              className="rounded-xl px-3 py-2 flex items-center gap-2"
            >
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
              <span className="text-[10px] font-mono text-slate-400">The Agent is analyzing…</span>
            </div>
          </div>
        )}
        {error && (
          <div
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)' }}
            className="rounded-lg px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2"
          >
            <span className="leading-snug">{error}</span>
            {failedQuestion && (
              <button
                type="button"
                onClick={() => send(failedQuestion)}
                className="text-[11px] font-semibold px-2 py-1 rounded border border-amber-400/35 hover:border-amber-300 text-amber-200 hover:text-white shrink-0"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        style={{ borderTop: '1px solid var(--brand-border)' }}
        className="p-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask The Agent about ${asset} flows…`}
          disabled={loading || !etfData}
          style={{ background: 'var(--brand-dark)', border: '1px solid var(--brand-border)' }}
          className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || !etfData}
          style={{ background: 'var(--brand-blue)' }}
          className="px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </form>
    </div>
  );
}
