import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import type { Alert } from '../../types';

const KIND_META: Record<Alert['kind'], { icon: string; color: string; bg: string; label: string }> = {
  inflow:    { icon: '▲', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  label: 'INFLOW' },
  outflow:   { icon: '▼', color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'OUTFLOW' },
  rotation:  { icon: '⇄', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', label: 'ROTATION' },
  milestone: { icon: '◆', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  label: 'MILESTONE' },
  anomaly:   { icon: '⚡', color: '#FB923C', bg: 'rgba(251,146,60,0.14)',  label: 'ANOMALY' },
};

type FilterKind = Alert['kind'] | 'all';
type FilterSeverity = Alert['severity'] | 'all';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AlertsPage() {
  const { alerts, loading, refresh } = useDashboard();
  const { density } = useDensity();
  const gap = density === 'comfortable' ? 'p-5 gap-5' : 'p-4 gap-4';

  const [kind,     setKind]     = useState<FilterKind>('all');
  const [severity, setSeverity] = useState<FilterSeverity>('all');

  const filtered = alerts.filter(a =>
    (kind     === 'all' || a.kind     === kind)     &&
    (severity === 'all' || a.severity === severity)
  );

  const KINDS:     FilterKind[]     = ['all', 'inflow', 'outflow', 'rotation', 'milestone', 'anomaly'];
  const SEVERITIES: FilterSeverity[] = ['all', 'high', 'med', 'low'];

  return (
    <div>
      <QuickStats />

      <div className={`max-w-screen-2xl mx-auto ${gap}`}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-white text-2xl">Smart Alerts</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} of {alerts.length} · AI-detected flow & anomaly events
            </p>
          </div>
          <button
            onClick={refresh} disabled={loading}
            style={{ color: 'var(--brand-accent)', border: '1px solid rgba(0,194,255,0.3)' }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 disabled:opacity-40"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Kind filter */}
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="flex items-center rounded-lg p-0.5"
          >
            {KINDS.map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={k === kind ? { background: 'var(--brand-blue)', color: 'white' } : { color: '#94A3B8' }}
                className="text-xs font-mono uppercase tracking-wider px-2.5 py-1.5 rounded transition-colors hover:text-white"
              >
                {k === 'all' ? 'All Types' : KIND_META[k].label}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="flex items-center rounded-lg p-0.5"
          >
            {SEVERITIES.map(s => {
              const color = s === 'high' ? '#FB923C' : s === 'med' ? '#FCD34D' : s === 'low' ? '#94A3B8' : undefined;
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  style={s === severity ? { background: 'var(--brand-blue)', color: 'white' } : { color: color ?? '#94A3B8' }}
                  className="text-xs font-mono uppercase tracking-wider px-2.5 py-1.5 rounded transition-colors hover:text-white"
                >
                  {s === 'all' ? 'All Severity' : s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alert cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{ border: '1px solid var(--brand-border)', background: 'var(--brand-card)' }}
            className="rounded-xl p-12 text-center text-slate-500 text-sm"
          >
            No alerts matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(a => {
              const s = KIND_META[a.kind];
              const glow = a.severity === 'high'
                ? `0 0 0 1px ${s.color}55, 0 0 16px ${s.color}25`
                : 'none';
              return (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--brand-card)',
                    border: '1px solid var(--brand-border)',
                    boxShadow: glow,
                  }}
                  className="rounded-xl p-4 flex gap-3 transition-all hover:border-white/20"
                >
                  <span
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
                    className="text-sm w-8 h-8 rounded-lg flex items-center justify-center font-mono shrink-0"
                  >
                    {s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider mb-1 flex-wrap">
                      <span style={{ color: s.color }}>{s.label}</span>
                      {a.ticker && <span className="text-slate-500">· {a.ticker}</span>}
                      <span className="text-slate-600">· {a.asset}</span>
                      <span className="ml-auto text-slate-600 whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                    </div>
                    <div className="text-sm text-slate-200 font-medium leading-snug mb-1">{a.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{a.body}</div>
                    <div className="mt-2">
                      <span
                        style={
                          a.severity === 'high'
                            ? { background: 'rgba(251,146,60,0.12)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.3)' }
                            : a.severity === 'med'
                            ? { background: 'rgba(252,211,77,0.1)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' }
                            : { background: 'rgba(148,163,184,0.08)', color: '#64748B', border: '1px solid rgba(148,163,184,0.2)' }
                        }
                        className="text-[10px] px-2 py-0.5 rounded font-mono uppercase"
                      >
                        {a.severity} severity
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
