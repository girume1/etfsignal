import { useDashboard } from '../contexts/DashboardContext';
import { formatUSD } from '../services/sosovalue';

export function QuickStats() {
  const { btcData, ethData, alerts, sentiment, activeLabel } = useDashboard();

  const stats = [
    {
      label: 'BTC ETF AUM',
      value: btcData ? formatUSD(btcData.totalNetAssets.value).replace('+', '') : '—',
      sub: btcData ? formatUSD(btcData.dailyNetInflow.value) + ' today' : '',
      color: (btcData?.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
    },
    {
      label: 'ETH ETF AUM',
      value: ethData ? formatUSD(ethData.totalNetAssets.value).replace('+', '') : '—',
      sub: ethData ? formatUSD(ethData.dailyNetInflow.value) + ' today' : '',
      color: (ethData?.dailyNetInflow.value || 0) >= 0 ? '#34D399' : '#F87171',
    },
    {
      label: `${activeLabel} Sentiment`,
      value: `${sentiment.score}`,
      sub: sentiment.label,
      color:
        sentiment.score >= 70 ? '#34D399' :
        sentiment.score >= 45 ? '#FCD34D' :
        sentiment.score >= 30 ? '#FB923C' : '#F87171',
    },
    {
      label: 'Active Alerts',
      value: `${alerts.filter(a => a.severity !== 'low').length}`,
      sub: `${alerts.length} total · last 24h`,
      color: '#A78BFA',
    },
  ];

  return (
    <div
      style={{ background: 'var(--brand-panel)', borderBottom: '1px solid var(--brand-border)' }}
      className="px-4 py-3"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div
            key={s.label}
            style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
            className="rounded-lg px-4 py-2.5 flex flex-col gap-0.5 data-row"
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
              {s.label}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-xl text-white count-in">{s.value}</span>
              {s.sub && (
                <span className="text-[10px] font-mono truncate" style={{ color: s.color }}>
                  {s.sub}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
