import type { RiskInput, RiskResult } from '../types';

/**
 * Recommended position size in vUSDC via half-Kelly, with a 10 vUSDC floor
 * and 20%-of-balance ceiling. r = tpPct / slPct; kellyEdge = (confidence * r
 * - (1 - confidence)) / r; rawSize = balance * kellyEdge * 0.5.
 */
export function computePositionSize(input: RiskInput): RiskResult {
  const { balance, tpPct, slPct, entryPrice, atr, slPrice, defaultBalance } = input;
  const confidence = Math.min(1, Math.max(0, input.confidence));

  const riskRewardRatio = slPct === 0 ? 0 : tpPct / slPct;
  const riskRewardWarning = riskRewardRatio < 1.5;

  let positionSize: number;
  let clamped = false;
  let capped = false;

  if (balance === 0) {
    positionSize = 0;
  } else if (slPct === 0) {
    positionSize = 10;
    clamped = true;
  } else {
    const kellyEdge = (confidence * riskRewardRatio - (1 - confidence)) / riskRewardRatio;
    const rawSize = balance * kellyEdge * 0.5;
    const ceiling = balance * 0.20;

    if (rawSize < 10) {
      positionSize = 10;
      clamped = true;
    } else if (rawSize > ceiling) {
      positionSize = ceiling;
      capped = true;
    } else {
      positionSize = rawSize;
    }
  }

  const result: RiskResult = {
    positionSize,
    riskRewardRatio,
    riskRewardWarning,
    clamped,
    capped,
    ...(defaultBalance !== undefined && { defaultBalance }),
  };

  if (atr && atr > 0 && entryPrice !== undefined && slPrice !== undefined) {
    result.slInAtr = Math.abs(entryPrice - slPrice) / atr;
    result.atrWarning = result.slInAtr > 3.0;
  }

  return result;
}

export interface LeveragedRiskResult extends RiskResult {
  marginRequired: number;    // positionSize / leverage — actual vUSDC posted as collateral
  leveragedNotional: number; // positionSize itself (margin * leverage)
  liquidationPrice: number;  // 0 if entryPrice is unknown/zero
  liquidationWarning: boolean; // true if liquidation is within 15% of entry
}

/**
 * Same half-Kelly sizing as computePositionSize, plus perps-specific margin
 * and liquidation-price estimates. Liquidation distance uses a 0.9 maintenance-
 * margin buffer: LONG = entry * (1 - 1/(leverage*0.9)), SHORT = entry * (1 + 1/(leverage*0.9)).
 */
export function computeLeveragedRisk(
  input: RiskInput & { leverage: number; side: 'BUY' | 'SELL' },
): LeveragedRiskResult {
  const base = computePositionSize(input);
  const leverage = Math.max(1, input.leverage);
  const entryPrice = input.entryPrice ?? 0;

  const marginRequired = base.positionSize / leverage;
  const leveragedNotional = base.positionSize;

  const liqDistanceFrac = 1 / (leverage * 0.9);
  const liquidationPrice = entryPrice > 0
    ? (input.side === 'BUY' ? entryPrice * (1 - liqDistanceFrac) : entryPrice * (1 + liqDistanceFrac))
    : 0;
  const liquidationWarning = entryPrice > 0 && Math.abs(entryPrice - liquidationPrice) / entryPrice < 0.15;

  return { ...base, marginRequired, leveragedNotional, liquidationPrice, liquidationWarning };
}
