import { describe, it, expect } from 'vitest';
import { computeLeveragedRisk } from '../services/riskManager';

const base = { balance: 1000, confidence: 0.55, tpPct: 3, slPct: 2, entryPrice: 60000 };

describe('computeLeveragedRisk', () => {
  it('marginRequired = positionSize / leverage', () => {
    const r = computeLeveragedRisk({ ...base, leverage: 20, side: 'BUY' });
    expect(r.marginRequired).toBeCloseTo(r.positionSize / 20, 6);
    expect(r.leveragedNotional).toBe(r.positionSize);
  });

  it('LONG liquidation price is below entry, SHORT is above entry', () => {
    const long = computeLeveragedRisk({ ...base, leverage: 10, side: 'BUY' });
    const short = computeLeveragedRisk({ ...base, leverage: 10, side: 'SELL' });
    expect(long.liquidationPrice).toBeLessThan(base.entryPrice);
    expect(short.liquidationPrice).toBeGreaterThan(base.entryPrice);
    // symmetric distance: entry * 1/(leverage*0.9)
    const dist = base.entryPrice / (10 * 0.9);
    expect(base.entryPrice - long.liquidationPrice).toBeCloseTo(dist, 2);
    expect(short.liquidationPrice - base.entryPrice).toBeCloseTo(dist, 2);
  });

  it('liquidationWarning true when liquidation distance < 15% of entry (high leverage)', () => {
    const highLev = computeLeveragedRisk({ ...base, leverage: 20, side: 'BUY' });
    // 1/(20*0.9) = 5.5% distance — well within 15%
    expect(highLev.liquidationWarning).toBe(true);
  });

  it('liquidationWarning false at low leverage (distance > 15%)', () => {
    const lowLev = computeLeveragedRisk({ ...base, leverage: 2, side: 'BUY' });
    // 1/(2*0.9) = 55.5% distance — well beyond 15%
    expect(lowLev.liquidationWarning).toBe(false);
  });

  it('liquidationPrice is 0 when entryPrice is unknown', () => {
    const r = computeLeveragedRisk({ ...base, entryPrice: undefined, leverage: 10, side: 'BUY' });
    expect(r.liquidationPrice).toBe(0);
    expect(r.liquidationWarning).toBe(false);
  });
});
