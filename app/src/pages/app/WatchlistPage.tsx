import { useMemo, useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { FundRow } from '../../components/EtfPanel';
import { getWatchlist } from '../../services/watchlist';
import type { EtfFund } from '../../types';

export default function WatchlistPage() {
  const { btcData, ethData, loading } = useDashboard();
  const [watchedTickers, setWatchedTickers] = useState<string[]>(() => getWatchlist());

  // Re-read on focus so stars toggled elsewhere (e.g. Dashboard) show up here
  useEffect(() => {
    const onFocus = () => setWatchedTickers(getWatchlist());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const funds: EtfFund[] = useMemo(() => {
    const all = [...(btcData?.list ?? []), ...(ethData?.list ?? [])];
    return all.filter(f => watchedTickers.includes(f.ticker));
  }, [btcData, ethData, watchedTickers]);

  return (
    <div>
      <div
        style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
        className="px-5 py-3 flex items-center gap-2"
      >
        <Star size={14} style={{ color: '#F59E0B' }} className="shrink-0" />
        <span className="text-xs font-semibold text-white uppercase tracking-widest font-mono">Watchlist</span>
      </div>

      <div className="max-w-screen-2xl mx-auto w-full p-5">
        <div
          style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
          className="rounded-xl p-4"
        >
          {loading ? (
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}
            </div>
          ) : funds.length === 0 ? (
            <div className="text-center py-10">
              <Star size={28} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm text-slate-400 mb-1">No starred funds yet</p>
              <p className="text-xs text-slate-600">
                Click the ★ next to any fund in the Dashboard&apos;s fund breakdown to pin it here.
              </p>
            </div>
          ) : (
            funds.map(fund => <FundRow key={fund.id} fund={fund} anomalies={[]} />)
          )}
        </div>
      </div>
    </div>
  );
}
