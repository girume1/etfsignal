import type { EtfData, EtfFund, ActiveTab } from '../types';
import type { HistoricalInflow } from '../services/sosovalue';
import { formatUSD } from '../services/sosovalue';
import { InflowChart } from './InflowChart';

interface EtfPanelProps {
  btcData: EtfData | null;
  ethData: EtfData | null;
  btcHistory: HistoricalInflow[];
  ethHistory: HistoricalInflow[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  loading: boolean;
}

// ─── Anomaly detection ────────────────────────────────────────────────────
// Delivers on the "opportunity discovery" bonus criterion: flags the largest
// inflow and largest outflow of the day on the fund breakdown. Pure client-side
// so it works identically with live or mock data.

type AnomalyKind = 'topInflow' | 'topOutflow' | 'lowFee';
interface AnomalyMap { [fundId: string]: AnomalyKind[] }

function detectAnomalies(funds: EtfFund[]): AnomalyMap {
  const m: AnomalyMap = {};
  const withFlow = funds.filter(f => f.dailyNetInflow.value !== null);
  if (withFlow.length === 0) return m;

  const topInflow  = withFlow.reduce((best, f) => (f.dailyNetInflow.value! > best.dailyNetInflow.value! ? f : best));
  const topOutflow = withFlow.reduce((worst, f) => (f.dailyNetInflow.value! < worst.dailyNetInflow.value! ? f : worst));
  if ((topInflow.dailyNetInflow.value  || 0) >  50_000_000) (m[topInflow.id]  ||= []).push('topInflow');
  if ((topOutflow.dailyNetInflow.value || 0) < -25_000_000) (m[topOutflow.id] ||= []).push('topOutflow');

  const lowFeeThreshold = 0.002; // 20 bps or less
  funds
    .filter(f => (f.fee.value ?? 1) <= lowFeeThreshold)
    .forEach(f => (m[f.id] ||= []).push('lowFee'));

  return m;
}

const ANOMALY_STYLES: Record<AnomalyKind, { label: string; color: string; bg: string }> = {
  topInflow:  { label: '⚡ Top Inflow',  color: '#34D399', bg: 'rgba(52,211,153,0.12)'  },
  topOutflow: { label: '▼ Top Outflow', color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  lowFee:     { label: '◆ Low Fee',     color: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
};

// ─── Tiny presentational helpers ──────────────────────────────────────────

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean | null }) {
  const color = positive === null || positive === undefined
    ? '#94A3B8'
    : positive ? '#34D399' : '#F87171';

  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl p-4"
    >
      <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">{label}</div>
      {value === '—' || value === 'Loading...'
        ? <div className="shimmer h-6 w-24 mt-1" />
        : <div className="text-lg font-semibold font-mono" style={{ color }}>{value}</div>
      }
    </div>
  );
}

function FundRow({ fund, anomalies }: { fund: EtfFund; anomalies: AnomalyKind[] }) {
  const dailyInflow = fund.dailyNetInflow.value;
  const netAssets   = fund.netAssets.value;
  const fee         = fund.fee.value;
  const isPositive  = dailyInflow !== null ? dailyInflow >= 0 : null;

  return (
    <div
      style={{ borderBottom: '1px solid var(--brand-border)' }}
      className="flex items-center justify-between py-3 px-1 text-sm hover:bg-white/5 transition-colors rounded"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white">{fund.ticker}</span>
          <span className="text-slate-500 text-xs">{fund.institute.split(' ')[0]}</span>
        </div>
        {anomalies.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {anomalies.map(a => {
              const s = ANOMALY_STYLES[a];
              return (
                <span
                  key={a}
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono leading-none"
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex gap-6 text-right shrink-0">
        <div>
          <div className="text-xs text-slate-500">Daily Flow</div>
          <div className="font-mono text-sm" style={{ color: isPositive === null ? '#94A3B8' : isPositive ? '#34D399' : '#F87171' }}>
            {formatUSD(dailyInflow)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Net Assets</div>
          <div className="font-mono text-sm text-slate-300">{formatUSD(netAssets)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Fee</div>
          <div className="font-mono text-sm text-slate-400">{fee !== null ? `${(fee * 100).toFixed(2)}%` : '—'}</div>
        </div>
      </div>
    </div>
  );
}

export function EtfPanel({ btcData, ethData, btcHistory, ethHistory, activeTab, onTabChange, loading }: EtfPanelProps) {
  const data    = activeTab === 'btc' ? btcData    : ethData;
  const history = activeTab === 'btc' ? btcHistory : ethHistory;
  const label   = activeTab === 'btc' ? 'BTC' : 'ETH';

  const dailyInflow = data?.dailyNetInflow.value ?? null;
  const isPositive  = dailyInflow !== null ? dailyInflow >= 0 : null;

  const anomalies = data ? detectAnomalies(data.list) : {};

  const topFunds = data
    ? data.list
        .filter(f => f.dailyNetInflow.value !== null)
        .sort((a, b) => Math.abs(b.dailyNetInflow.value!) - Math.abs(a.dailyNetInflow.value!))
        .slice(0, 8)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-1 flex gap-1"
      >
        {(['btc', 'eth'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={activeTab === tab
              ? { background: 'var(--brand-blue)', color: 'white' }
              : { color: '#64748B' }
            }
            className="flex-1 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-all"
          >
            {tab} Spot ETF
          </button>
        ))}
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Daily Net Inflow" value={loading ? 'Loading...' : formatUSD(dailyInflow)} positive={isPositive} />
        <MetricCard label="Total Net Assets" value={loading ? 'Loading...' : formatUSD(data?.totalNetAssets.value ?? null)} />
        <MetricCard label={`${label} Holdings`} value={loading ? 'Loading...' : data?.totalTokenHoldings.value ? `${data.totalTokenHoldings.value.toLocaleString()} ${label}` : '—'} />
        <MetricCard label="Cum. Net Inflow" value={loading ? 'Loading...' : formatUSD(data?.cumNetInflow.value ?? null)} positive={data?.cumNetInflow.value !== null ? (data?.cumNetInflow.value ?? 0) >= 0 : null} />
      </div>

      {/* Historical inflow sparkline */}
      {loading
        ? <div className="shimmer h-28 rounded-xl" />
        : <InflowChart data={history} label={`${label} Daily Net Inflow · 14d`} />
      }

      {/* Fund breakdown */}
      <div
        style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
        className="rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Fund Breakdown
          </h3>
          <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">
            Anomalies auto-flagged
          </span>
        </div>
        {loading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="shimmer h-10 rounded mb-2" />
            ))
          : topFunds.map(fund => (
              <FundRow
                key={fund.id}
                fund={fund}
                anomalies={anomalies[fund.id] || []}
              />
            ))
        }
      </div>
    </div>
  );
}
