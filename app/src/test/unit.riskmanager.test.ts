import { describe, it, expect } from 'vitest';
import { computePositionSize } from '../services/riskManager';

describe('computePositionSize', () => {
  it('unclamped: matches half-Kelly formula exactly', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.55, tpPct: 3, slPct: 2 });
    // r = 1.5, kellyEdge = (0.55*1.5 - 0.45)/1.5 = 0.25, rawSize = 1000*0.25*0.5 = 125
    expect(result.positionSize).toBeCloseTo(125, 2);
    expect(result.clamped).toBe(false);
    expect(result.capped).toBe(false);
    expect(result.riskRewardRatio).toBeCloseTo(1.5, 2);
  });

  it('floor: rawSize below 10 clamps to 10', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.505, tpPct: 1, slPct: 1 });
    // r = 1, kellyEdge = (0.505 - 0.495)/1 = 0.01, rawSize = 1000*0.01*0.5 = 5 -> floored
    expect(result.positionSize).toBe(10);
    expect(result.clamped).toBe(true);
  });

  it('ceiling: rawSize above 20% of balance caps at balance*0.20', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.99, tpPct: 10, slPct: 1 });
    expect(result.positionSize).toBe(200);
    expect(result.capped).toBe(true);
  });

  it('slPct === 0: floor + warning, Kelly skipped', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.7, tpPct: 5, slPct: 0 });
    expect(result.positionSize).toBe(10);
    expect(result.clamped).toBe(true);
    expect(result.riskRewardWarning).toBe(true);
  });

  it('balance === 0: positionSize is 0, no clamp/cap', () => {
    const result = computePositionSize({ balance: 0, confidence: 0.7, tpPct: 5, slPct: 2 });
    expect(result.positionSize).toBe(0);
    expect(result.clamped).toBe(false);
    expect(result.capped).toBe(false);
  });

  it('riskRewardWarning true when ratio < 1.5', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.6, tpPct: 2, slPct: 2 });
    expect(result.riskRewardWarning).toBe(true);
  });

  it('ATR provided: computes slInAtr and atrWarning', () => {
    const result = computePositionSize({
      balance: 1000, confidence: 0.7, tpPct: 6, slPct: 2,
      entryPrice: 100, slPrice: 96, atr: 1,
    });
    expect(result.slInAtr).toBeCloseTo(4, 2);
    expect(result.atrWarning).toBe(true);
  });

  it('ATR absent: slInAtr and atrWarning are omitted', () => {
    const result = computePositionSize({ balance: 1000, confidence: 0.7, tpPct: 6, slPct: 2 });
    expect(result.slInAtr).toBeUndefined();
    expect(result.atrWarning).toBeUndefined();
  });
});
