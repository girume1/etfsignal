import type { EtfFund } from '../types';

export type AnomalyKind = 'topInflow' | 'topOutflow' | 'lowFee';
export interface AnomalyMap { [fundId: string]: AnomalyKind[] }

export function detectAnomalies(funds: EtfFund[]): AnomalyMap {
  const m: AnomalyMap = Object.create(null) as AnomalyMap;

  // Low fee flagging is independent of inflow data
  const lowFeeThreshold = 0.002; // 20 bps or less
  funds
    .filter(f => (f.fee.value ?? 1) <= lowFeeThreshold)
    .forEach(f => (m[f.id] ??= []).push('lowFee'));

  const withFlow = funds.filter(f => f.dailyNetInflow.value !== null);
  if (withFlow.length === 0) return m;

  const topInflow  = withFlow.reduce((best, f) => (f.dailyNetInflow.value! > best.dailyNetInflow.value! ? f : best));
  const topOutflow = withFlow.reduce((worst, f) => (f.dailyNetInflow.value! < worst.dailyNetInflow.value! ? f : worst));
  if ((topInflow.dailyNetInflow.value  || 0) >  50_000_000) (m[topInflow.id]  ??= []).push('topInflow');
  if ((topOutflow.dailyNetInflow.value || 0) < -25_000_000) (m[topOutflow.id] ??= []).push('topOutflow');

  return m;
}

export function getTopFunds<T extends { dailyNetInflow: { value: number | null } }>(funds: T[], limit = 10): T[] {
  return funds
    .filter(f => f.dailyNetInflow.value !== null)
    .sort((a, b) => Math.abs(b.dailyNetInflow.value!) - Math.abs(a.dailyNetInflow.value!))
    .slice(0, limit);
}
