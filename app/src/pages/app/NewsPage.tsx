import { useState, useMemo } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDensity } from '../../contexts/DensityContext';
import { QuickStats } from '../../components/QuickStats';
import { getNewsTitle } from '../../services/sosovalue';
import type { NewsItem } from '../../types';
import { NEWS_CATEGORY_MAP } from '../../types';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const CATS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];

export default function NewsPage() {
  const { news, loading, refresh } = useDashboard();
  const { density } = useDensity();
  const gap = density === 'comfortable' ? 'p-5' : 'p-4';

  const [search, setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list: NewsItem[] = news;
    if (catFilter !== null) list = list.filter(n => n.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => getNewsTitle(n).toLowerCase().includes(q));
    }
    return list;
  }, [news, catFilter, search]);

  const mobile = density === 'mobile';

  return (
    <div>
      <QuickStats />

      <div className={`max-w-screen-2xl mx-auto ${gap}`}>
        {/* Header bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="font-display text-white text-2xl">Market News</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filtered.length} stories · BTC & ETH ETF coverage
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

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search headlines…"
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
          />
          <div
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="flex items-center rounded-lg p-0.5 gap-0.5 overflow-x-auto"
          >
            <button
              onClick={() => setCatFilter(null)}
              style={catFilter === null ? { background: 'var(--brand-blue)', color: 'white' } : { color: '#94A3B8' }}
              className="text-xs font-mono uppercase tracking-wider px-2.5 py-1.5 rounded transition-colors hover:text-white whitespace-nowrap"
            >
              All
            </button>
            {CATS.filter(c => c > 0).map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={catFilter === c ? { background: 'var(--brand-blue)', color: 'white' } : { color: '#94A3B8' }}
                className="text-xs font-mono uppercase tracking-wider px-2.5 py-1.5 rounded transition-colors hover:text-white whitespace-nowrap"
              >
                {NEWS_CATEGORY_MAP[c] ?? `Cat ${c}`}
              </button>
            ))}
          </div>
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className="shimmer h-28 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{ border: '1px solid var(--brand-border)', background: 'var(--brand-card)' }}
            className="rounded-xl p-12 text-center text-slate-500 text-sm"
          >
            No news found.
          </div>
        ) : (
          <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
            {filtered.map(item => {
              const title = getNewsTitle(item);
              const cat   = NEWS_CATEGORY_MAP[item.category] ?? 'General';
              return (
                <a
                  key={item.id}
                  href={item.sourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
                  className="rounded-xl p-4 flex flex-col gap-2 hover:border-white/20 transition-all group data-row"
                >
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    <span
                      style={{ background: 'rgba(0,194,255,0.08)', color: 'var(--brand-accent)', border: '1px solid rgba(0,194,255,0.15)' }}
                      className="px-1.5 py-0.5 rounded"
                    >
                      {cat}
                    </span>
                    {item.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-slate-600">{tag}</span>
                    ))}
                    <span className="ml-auto">{timeAgo(item.releaseTime)}</span>
                  </div>
                  <p className="text-sm text-slate-200 font-medium leading-snug group-hover:text-white transition-colors">
                    {title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-auto">
                    <span>{item.author}</span>
                    <span className="ml-auto" style={{ color: 'var(--brand-accent)' }}>Read →</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
