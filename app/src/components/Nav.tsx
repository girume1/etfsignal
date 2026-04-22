import { Link, useLocation } from 'react-router-dom';

export function Nav() {
  const location = useLocation();
  const links = [
    { path: '/', label: 'Home' },
    { path: '/how-it-works', label: 'How It Works' },
    { path: '/about', label: 'About' },
  ];

  return (
    <nav
      style={{ background: 'rgba(10,15,30,0.7)', borderBottom: '1px solid var(--brand-border)', backdropFilter: 'blur(20px)' }}
      className="px-6 py-4 flex items-center justify-between sticky top-0 z-50"
    >
      <Link to="/" className="flex items-center gap-3 group">
        <div
          style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105"
        >
          E
        </div>
        <div>
          <span className="font-display text-white text-xl tracking-tight">ETFSignal</span>
          <span style={{ color: 'var(--brand-accent)' }} className="font-display text-xl"> AI</span>
        </div>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {links.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className="text-sm font-medium transition-colors"
            style={{ color: location.pathname === link.path ? 'white' : '#64748B' }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Link
        to="/app"
        style={{ background: 'linear-gradient(135deg, #0057FF, #00C2FF)' }}
        className="px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 hover:scale-105"
      >
        Launch App →
      </Link>
    </nav>
  );
}

export function Footer() {
  return (
    <footer
      style={{ borderTop: '1px solid var(--brand-border)' }}
      className="py-8 px-6 text-center"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-slate-500 mb-2">
          ETFSignal AI · SoSoValue Buildathon 2026
        </p>
        <p className="text-xs text-slate-600">
          Data by{' '}
          <a href="https://sosovalue.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--brand-accent)' }} className="hover:underline">SoSoValue</a>
          {' '}· Trading on{' '}
          <a href="https://sodex.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--brand-accent)' }} className="hover:underline">SoDEX Testnet</a>
          {' '}· AI by Anthropic Claude
        </p>
        <p className="text-xs text-slate-700 mt-2">Not financial advice · Testnet only</p>
      </div>
    </footer>
  );
}
