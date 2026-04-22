import { NavLink, useLocation } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import { formatUSD } from '../services/sosovalue';

const NAV = [
  { path: '/app',          icon: '⊞', label: 'Overview',  hint: 'Full cockpit view'            },
  { path: '/app/flows',    icon: '⇅', label: 'Flows',     hint: 'ETF inflows & market share'  },
  { path: '/app/signals',  icon: '◎', label: 'Signals',   hint: 'AI signals & Ask Claude'      },
  { path: '/app/alerts',   icon: '⚡', label: 'Alerts',    hint: 'Smart flow & anomaly alerts'  },
  { path: '/app/news',     icon: '◈', label: 'News',      hint: 'Market news feed'              },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { btcData, ethData, alerts, activeTab } = useDashboard();
  const location = useLocation();

  const highAlerts = alerts.filter(a => a.severity === 'high').length;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        style={{
          background: 'var(--brand-panel)',
          borderRight: '1px solid var(--brand-border)',
          width: '220px',
        }}
        className={`
          fixed top-0 bottom-0 left-0 z-40 flex flex-col pt-[57px]
          transition-transform duration-200 ease-out
          lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:translate-x-0 lg:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const exact = item.path === '/app';
            const active = exact
              ? location.pathname === '/app'
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={exact}
                onClick={() => onClose()}
                title={item.hint}
                style={active
                  ? { background: 'rgba(0,87,255,0.15)', color: 'white', borderLeft: '2px solid var(--brand-blue)' }
                  : { color: '#94A3B8', borderLeft: '2px solid transparent' }
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-medium transition-colors hover:bg-white/5 hover:text-white pl-[calc(0.75rem-2px)]"
              >
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {/* Alerts badge */}
                {item.path === '/app/alerts' && highAlerts > 0 && (
                  <span
                    style={{ background: 'rgba(251,146,60,0.2)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.4)' }}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono min-w-[1.25rem] text-center"
                  >
                    {highAlerts}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom stats strip */}
        <div
          style={{ borderTop: '1px solid var(--brand-border)' }}
          className="px-3 py-4 space-y-2 text-[11px] font-mono text-slate-500"
        >
          {btcData && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">BTC AUM</span>
              <span className="text-slate-300">
                {formatUSD(btcData.totalNetAssets.value).replace('+', '')}
              </span>
            </div>
          )}
          {ethData && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">ETH AUM</span>
              <span className="text-slate-300">
                {formatUSD(ethData.totalNetAssets.value).replace('+', '')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Asset</span>
            <span style={{ color: activeTab === 'btc' ? '#F59E0B' : '#818CF8' }}>
              {activeTab.toUpperCase()}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
