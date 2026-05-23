import type { Alert, EtfData } from '../types';
import type { HistoricalInflow } from '../types';

/**
 * Derives live alerts from ETF data and historical inflows.
 * This is a pure function — no side effects, no API calls.
 *
 * Rules:
 * 1. Top BTC fund with dailyNetInflow > $50M → kind: 'inflow', severity: 'high'
 * 2. Top ETH fund with dailyNetInflow > $10M → kind: 'inflow', severity: 'med'
 * 3. If btcHist.length >= 30 and today's BTC inflow > mean + 2*stddev → kind: 'anomaly', severity: 'high'
 * 4. Any fund with dailyNetInflow < -$25M → kind: 'outflow', severity: 'med'
 * 5. BTC inflow positive and ETH inflow negative (or vice versa) → kind: 'rotation', severity: 'med'
 */
export function deriveAlerts(
  btcData: EtfData,
  ethData: EtfData,
  btcHist: HistoricalInflow[],
): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // ── Rule 1: Top BTC fund inflow > $50M ──────────────────────────────────
  const topBtcFund = btcData.list
    .filter(f => (f.dailyNetInflow.value ?? 0) > 50_000_000)
    .sort((a, b) => (b.dailyNetInflow.value ?? 0) - (a.dailyNetInflow.value ?? 0))[0];

  if (topBtcFund) {
    const inflow = topBtcFund.dailyNetInflow.value!;
    alerts.push({
      id: `inflow-${topBtcFund.ticker}`,
      kind: 'inflow',
      title: `${topBtcFund.ticker} Large Inflow`,
      body: `${topBtcFund.ticker} (${topBtcFund.institute}) recorded a daily net inflow of $${(inflow / 1e6).toFixed(1)}M, signalling strong institutional demand.`,
      ticker: topBtcFund.ticker,
      asset: 'BTC',
      timestamp: now,
      severity: 'high',
    });
  }

  // ── Rule 2: Top ETH fund inflow > $10M ──────────────────────────────────
  const topEthFund = ethData.list
    .filter(f => (f.dailyNetInflow.value ?? 0) > 10_000_000)
    .sort((a, b) => (b.dailyNetInflow.value ?? 0) - (a.dailyNetInflow.value ?? 0))[0];

  if (topEthFund) {
    const inflow = topEthFund.dailyNetInflow.value!;
    alerts.push({
      id: `inflow-${topEthFund.ticker}`,
      kind: 'inflow',
      title: `${topEthFund.ticker} Notable Inflow`,
      body: `${topEthFund.ticker} (${topEthFund.institute}) recorded a daily net inflow of $${(inflow / 1e6).toFixed(1)}M.`,
      ticker: topEthFund.ticker,
      asset: 'ETH',
      timestamp: now,
      severity: 'med',
    });
  }

  // ── Rule 3: BTC anomaly — inflow > mean + 2*stddev ──────────────────────
  if (btcHist.length >= 30) {
    const values = btcHist.map(h => h.inflow);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length;
    const stddev = Math.sqrt(variance);
    const latest = btcData.dailyNetInflow.value ?? 0;

    if (latest > mean + 2 * stddev) {
      alerts.push({
        id: 'anomaly-btc',
        kind: 'anomaly',
        title: 'BTC Inflow Anomaly Detected',
        body: `Today's BTC ETF net inflow of $${(latest / 1e6).toFixed(1)}M is more than 2 standard deviations above the ${btcHist.length}-day mean ($${(mean / 1e6).toFixed(1)}M). This is a statistically unusual event.`,
        asset: 'BTC',
        timestamp: now,
        severity: 'high',
      });
    }
  }

  // ── Rule 4: Any fund with outflow < -$25M ────────────────────────────────
  const allFunds = [
    ...btcData.list.map(f => ({ ...f, asset: 'BTC' as const })),
    ...ethData.list.map(f => ({ ...f, asset: 'ETH' as const })),
  ];

  for (const fund of allFunds) {
    const outflow = fund.dailyNetInflow.value ?? 0;
    if (outflow < -25_000_000) {
      alerts.push({
        id: `outflow-${fund.ticker}`,
        kind: 'outflow',
        title: `${fund.ticker} Significant Outflow`,
        body: `${fund.ticker} (${fund.institute}) recorded a daily net outflow of $${(Math.abs(outflow) / 1e6).toFixed(1)}M, suggesting institutional selling pressure.`,
        ticker: fund.ticker,
        asset: fund.asset,
        timestamp: now,
        severity: 'med',
      });
    }
  }

  // ── Rule 5: BTC/ETH rotation signal ─────────────────────────────────────
  const btcInflow = btcData.dailyNetInflow.value ?? 0;
  const ethInflow = ethData.dailyNetInflow.value ?? 0;

  const btcPositive = btcInflow > 0;
  const ethPositive = ethInflow > 0;

  if (btcPositive !== ethPositive) {
    const fromAsset = btcPositive ? 'ETH' : 'BTC';
    const toAsset = btcPositive ? 'BTC' : 'ETH';
    alerts.push({
      id: 'rotation-btc-eth',
      kind: 'rotation',
      title: `${fromAsset} → ${toAsset} Rotation Signal`,
      body: `BTC ETF inflows are ${btcPositive ? 'positive' : 'negative'} ($${(btcInflow / 1e6).toFixed(1)}M) while ETH ETF inflows are ${ethPositive ? 'positive' : 'negative'} ($${(ethInflow / 1e6).toFixed(1)}M), suggesting capital rotation between assets.`,
      asset: 'MKT',
      timestamp: now,
      severity: 'med',
    });
  }

  return alerts;
}
