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
