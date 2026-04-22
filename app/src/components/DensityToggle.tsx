import { useDensity, type Density } from '../contexts/DensityContext';

const OPTIONS: { value: Density; label: string; icon: string; hint: string }[] = [
  { value: 'mobile',      label: 'Mobile',      icon: '▯',  hint: 'Single-column, stacked panels' },
  { value: 'compact',     label: 'Compact',     icon: '▦',  hint: 'Dense Bloomberg-style layout' },
  { value: 'comfortable', label: 'Comfortable', icon: '▤',  hint: 'Roomy spacing for big screens' },
];

/**
 * Desktop / Web / Mobile layout selector. Chrome-like pill switcher that
 * persists the choice in localStorage. `auto` mode follows viewport size —
 * shows a subtle "A" indicator and reactivates when user clicks a manual
 * option. Mobile option forces single-column even on large viewports.
 */
export function DensityToggle({ compact = false }: { compact?: boolean }) {
  const { density, setDensity, auto, setAuto } = useDensity();

  return (
    <div className="flex items-center gap-1">
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="inline-flex items-center rounded-lg p-0.5"
      >
        {OPTIONS.map(o => {
          const active = density === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setDensity(o.value)}
              title={o.hint}
              style={
                active
                  ? { background: 'var(--brand-blue)', color: '#fff' }
                  : { color: '#94A3B8' }
              }
              className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${
                active ? '' : 'hover:text-white'
              }`}
            >
              <span>{o.icon}</span>
              {!compact && <span>{o.label}</span>}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setAuto(!auto)}
        title={auto ? 'Auto-adapt to viewport (on)' : 'Auto-adapt off — manual mode'}
        style={{
          background: auto ? 'rgba(0,194,255,0.12)' : 'transparent',
          color: auto ? 'var(--brand-accent)' : '#64748B',
          border: `1px solid ${auto ? 'rgba(0,194,255,0.3)' : 'var(--brand-border)'}`,
        }}
        className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-1 rounded transition-colors"
      >
        A
      </button>
    </div>
  );
}
