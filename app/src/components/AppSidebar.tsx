import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, TrendingUp, Zap,
  Newspaper, ArrowLeftRight, Star, PieChart,
  Settings, Bot,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';

const NAV_MAIN = [
  { path: '/app',         icon: LayoutDashboard,  label: 'Dashboard',      exact: true  },
  { path: '/app/flows',   icon: BarChart2,         label: 'ETF Flows',      exact: false },
  { path: '/app/signals', icon: Zap,               label: 'AI Signals',     exact: false },
  { path: '/app/alerts',  icon: TrendingUp,        label: 'Alerts',         exact: false },
  { path: '/app/news',    icon: Newspaper,         label: 'News & Insights',exact: false },
];

const NAV_TRADE = [
  { path: '/app/trade', icon: ArrowLeftRight, label: 'SoDEX Trade',  exact: false },
];

const NAV_ACCOUNT = [
  { icon: Star,      label: 'Watchlist',  disabled: true },
  { icon: PieChart,  label: 'Portfolio',  disabled: true },
  { icon: Settings,  label: 'Settings',   disabled: true },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { alerts } = useDashboard();
  const location = useLocation();
  const highAlerts = alerts.filter(a => a.severity === 'high').length;

  function NavItem({
    path, icon: Icon, label, exact = false, badge = 0, disabled = false,
  }: {
    path?: string; icon: any; label: string;
    exact?: boolean; badge?: number; disabled?: boolean;
  }) {
    if (disabled || !path) {
      return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-35 cursor-not-allowed select-none">
          <Icon size={16} className="shrink-0 text-slate-500" />
          <span className="flex-1 text-slate-500">{label}</span>
          <span className="text-[9px] font-mono text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">SOON</span>
        </div>
      );
    }

    const active = exact
      ? location.pathname === path
      : location.pathname.startsWith(path);

    return (
      <NavLink
        to={path}
        end={exact}
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
        style={active ? {
          background: 'rgba(0,255,167,0.08)',
          color: '#fff',
          border: '1px solid rgba(0,255,167,0.2)',
          boxShadow: '0 0 20px rgba(0,255,167,0.06)',
        } : {
          color: '#64748B',
          border: '1px solid transparent',
        }}
      >
        <Icon
          size={16}
          className="shrink-0 transition-colors"
          style={{ color: active ? '#00FFA7' : undefined }}
        />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono min-w-[1.25rem] text-center"
            style={{ background: 'rgba(0,255,167,0.15)', color: '#00FFA7', border: '1px solid rgba(0,255,167,0.35)' }}>
            {badge}
          </span>
        )}
      </NavLink>
    );
  }

  function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="mb-1">
        <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600 font-mono">
          {label}
        </p>
        <div className="space-y-0.5">{children}</div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/70 z-30 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 flex flex-col
          transition-transform duration-200 ease-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: 228,
          background: '#04101B',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm text-white"
              style={{ background: '#FF7637', boxShadow: '0 0 20px rgba(255,118,55,0.3)' }}
            >
              E
            </div>
            <div>
              <div className="font-display text-white text-base leading-tight tracking-tight">
                ETFSignal<span style={{ color: '#FF7637' }}>AI</span>
              </div>
              <div className="text-[9px] text-slate-500 font-mono tracking-wide">AI-Powered ETF Intelligence</div>
            </div>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
          <NavSection label="Main">
            {NAV_MAIN.map(item => (
              <NavItem
                key={item.path}
                path={item.path}
                icon={item.icon}
                label={item.label}
                exact={item.exact}
                badge={item.path === '/app/alerts' ? highAlerts : 0}
              />
            ))}
          </NavSection>

          <NavSection label="Trading">
            {NAV_TRADE.map(item => (
              <NavItem key={item.path} path={item.path} icon={item.icon} label={item.label} />
            ))}
          </NavSection>

          <NavSection label="Account">
            {NAV_ACCOUNT.map(item => (
              <NavItem key={item.label} icon={item.icon} label={item.label} disabled />
            ))}
          </NavSection>
        </nav>

        {/* ── AI Advantage promo card ───────────────────────────── */}
        <div className="px-3 pb-3">
          <div
            className="rounded-xl p-3.5"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,167,0.1), rgba(0,255,167,0.04))',
              border: '1px solid rgba(0,255,167,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Bot size={14} style={{ color: '#00FFA7' }} />
              <span className="text-xs font-semibold text-white">AI Advantage</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
              Our AI analyzes ETF flows, news sentiment &amp; market data to find high-probability trades.
            </p>
            <NavLink
              to="/app/signals"
              onClick={onClose}
              className="block text-center text-[11px] font-semibold py-1.5 rounded-lg transition-all hover:opacity-90"
              style={{ background: '#00FFA7', color: '#06080B' }}
            >
              Learn More
            </NavLink>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="text-[9px] text-slate-600 font-mono">© 2025 ETFSignalAI</span>
          <div className="flex items-center gap-3">
            {[
              { href: 'https://twitter.com', label: 'Twitter', icon: '𝕏' },
              { href: 'https://t.me/ETFSignalAIBot', label: 'Telegram', icon: '✈' },
            ].map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-slate-600 hover:text-slate-300 transition-colors text-sm"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
