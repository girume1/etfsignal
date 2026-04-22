import type { Alert } from '../types';

interface AlertsPanelProps {
  alerts: Alert[];
  loading: boolean;
}

const KIND_STYLES: Record<Alert['kind'], { icon: string; color: string; bg: string; label: string }> = {
  inflow:    { icon: '▲', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  label: 'INFLOW' },
  outflow:   { icon: '▼', color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'OUTFLOW' },
  rotation:  { icon: '⇄', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', label: 'ROTATION' },
  milestone: { icon: '◆', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  label: 'MILESTONE' },
  anomaly:   { icon: '⚡', color: '#FB923C', bg: 'rgba(251,146,60,0.14)',  label: 'ANOMALY' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Smart alerts feed — derived from flow + sentiment anomalies. Renders with
 * severity-driven border glow so high-severity items catch the eye.
 */
export function AlertsPanel({ alerts, loading }: AlertsPanelProps) {
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl flex flex-col"
    >
      <div
        style={{ borderBottom: '1px solid var(--brand-border)' }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Smart Alerts</span>
          <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
        </div>
        <span className="text-xs text-slate-500">{alerts.length}</span>
      </div>

      <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-3">
                <div className="shimmer h-3 w-full rounded mb-2" />
                <div className="shimmer h-3 w-2/3 rounded" />
              </div>
            ))
          : alerts.map(a => {
              const s = KIND_STYLES[a.kind];
              const glow = a.severity === 'high' ? `0 0 0 1px ${s.color}55, 0 0 12px ${s.color}30` : 'none';
              return (
                <div key={a.id} className="p-3" style={{ boxShadow: glow }}>
                  <div className="flex items-start gap-2">
                    <span
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
                      className="text-xs w-6 h-6 rounded-md flex items-center justify-center font-mono shrink-0"
                    >
                      {s.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider mb-0.5">
                        <span style={{ color: s.color }}>{s.label}</span>
                        {a.ticker && <span className="text-slate-500">· {a.ticker}</span>}
                        <span className="text-slate-600">· {a.asset}</span>
                        <span className="ml-auto text-slate-600">{timeAgo(a.timestamp)}</span>
                      </div>
                      <div className="text-xs text-slate-200 font-medium leading-snug mb-0.5">{a.title}</div>
                      <div className="text-xs text-slate-500 leading-snug">{a.body}</div>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
