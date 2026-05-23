/**
 * Property-based tests — data computation properties
 * Feature: etfsignal-hackathon
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeSentiment } from '../services/sentiment';
import { detectAnomalies, getTopFunds } from '../components/EtfPanel';

// ─── P8: Sentiment score range invariant ─────────────────────────────────
// Validates: Requirements 5.2

describe('P8: computeSentiment score range invariant', () => {
  it('always returns score in [0, 100] for any array of floats', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -1e9, max: 1e9, noNaN: true })),
        (inflows) => {
          const result = computeSentiment(inflows);
          return result.score >= 0 && result.score <= 100;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── P9: Sentiment label correctness ─────────────────────────────────────
// Validates: Requirements 5.3

/**
 * Maps a score in [0, 100] to the expected sentiment label per the spec thresholds.
 * ≥75 → "Strongly bullish"
 * ≥60 → "Cautiously bullish"
 * ≥45 → "Neutral"
 * ≥30 → "Cautiously bearish"
 *  <30 → "Strongly bearish"
 */
function expectedLabel(score: number): string {
  if (score >= 75) return 'Strongly bullish';
  if (score >= 60) return 'Cautiously bullish';
  if (score >= 45) return 'Neutral';
  if (score >= 30) return 'Cautiously bearish';
  return 'Strongly bearish';
}

describe('P9: Sentiment label correctness', () => {
  it('label matches the correct threshold range for any score in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          // Build an inflow array that will produce exactly this score.
          // computeSentiment needs at least 4 values; we craft inputs so the
          // clamped score equals our target by using a constant array where
          // recent == prior (momentum = 0) and posRatio drives the score.
          //
          // Formula: score = round(50 + 0 + (posRatio - 0.5) * 40)
          // => posRatio = (score - 50) / 40 + 0.5
          //
          // We use 10 values: k positive, (10-k) negative.
          // posRatio = k/10, so k = round((score - 50) / 40 * 10 + 5)
          // Clamp k to [0, 10].
          const k = Math.max(0, Math.min(10, Math.round((score - 50) / 40 * 10 + 5)));
          const inflows = [
            ...Array(k).fill(1),
            ...Array(10 - k).fill(-1),
          ];
          const result = computeSentiment(inflows);
          return result.label === expectedLabel(result.score);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('label is always one of the five valid labels for any score in [0, 100]', () => {
    const validLabels = new Set([
      'Strongly bullish',
      'Cautiously bullish',
      'Neutral',
      'Cautiously bearish',
      'Strongly bearish',
    ]);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const k = Math.max(0, Math.min(10, Math.round((score - 50) / 40 * 10 + 5)));
          const inflows = [
            ...Array(k).fill(1),
            ...Array(10 - k).fill(-1),
          ];
          const result = computeSentiment(inflows);
          return validLabels.has(result.label);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── P10: Fund breakdown sort and limit ──────────────────────────────────
// Validates: Requirements 6.1

describe('P10: Fund breakdown sort and limit', () => {
  it('returns at most 10 funds for any input array', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dailyNetInflow: fc.record({
              value: fc.oneof(fc.constant(null), fc.float({ noNaN: true })),
            }),
          }),
          { maxLength: 30 },
        ),
        (funds) => {
          const result = getTopFunds(funds);
          return result.length <= 10;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result is sorted by absolute daily inflow descending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dailyNetInflow: fc.record({
              value: fc.oneof(fc.constant(null), fc.float({ noNaN: true })),
            }),
          }),
          { maxLength: 30 },
        ),
        (funds) => {
          const result = getTopFunds(funds);
          for (let i = 1; i < result.length; i++) {
            const prev = Math.abs(result[i - 1].dailyNetInflow.value!);
            const curr = Math.abs(result[i].dailyNetInflow.value!);
            if (prev < curr) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result contains only funds with non-null dailyNetInflow', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dailyNetInflow: fc.record({
              value: fc.oneof(fc.constant(null), fc.float({ noNaN: true })),
            }),
          }),
          { maxLength: 30 },
        ),
        (funds) => {
          const result = getTopFunds(funds);
          return result.every(f => f.dailyNetInflow.value !== null);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── P11: Anomaly detection correctness ──────────────────────────────────
// Validates: Requirements 6.2, 6.3, 6.4

describe('P11: Anomaly detection correctness', () => {
  // Use uniqueArray to ensure fund ids are distinct (matching real EtfFund semantics)
  const fundArb = fc.uniqueArray(
    fc.record({
      id: fc.string({ minLength: 1 }),
      fee: fc.record({
        value: fc.oneof(
          fc.constant(null),
          fc.float({ min: Math.fround(0), max: Math.fround(0.05), noNaN: true }),
        ),
      }),
      dailyNetInflow: fc.record({
        value: fc.oneof(
          fc.constant(null),
          fc.float({ min: Math.fround(-1e8), max: Math.fround(1e8), noNaN: true }),
        ),
      }),
    }),
    { selector: (f) => f.id },
  );

  it('at most one fund is flagged topInflow, and only if its inflow > 50_000_000', () => {
    fc.assert(
      fc.property(fundArb, (funds) => {
        const anomalies = detectAnomalies(funds as Parameters<typeof detectAnomalies>[0]);
        const topInflowFunds = Object.entries(anomalies)
          .filter(([, kinds]) => kinds.includes('topInflow'))
          .map(([id]) => id);

        // At most one
        if (topInflowFunds.length > 1) return false;

        // Only if inflow > 50_000_000
        for (const id of topInflowFunds) {
          const fund = funds.find(f => f.id === id);
          if (!fund || (fund.dailyNetInflow.value ?? 0) <= 50_000_000) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it('at most one fund is flagged topOutflow, and only if its inflow < -25_000_000', () => {
    fc.assert(
      fc.property(fundArb, (funds) => {
        const anomalies = detectAnomalies(funds as Parameters<typeof detectAnomalies>[0]);
        const topOutflowFunds = Object.entries(anomalies)
          .filter(([, kinds]) => kinds.includes('topOutflow'))
          .map(([id]) => id);

        // At most one
        if (topOutflowFunds.length > 1) return false;

        // Only if inflow < -25_000_000
        for (const id of topOutflowFunds) {
          const fund = funds.find(f => f.id === id);
          if (!fund || (fund.dailyNetInflow.value ?? 0) >= -25_000_000) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it('every fund with fee.value <= 0.002 is flagged lowFee, and no fund with fee.value > 0.002 is flagged lowFee', () => {
    fc.assert(
      fc.property(fundArb, (funds) => {
        const anomalies = detectAnomalies(funds as Parameters<typeof detectAnomalies>[0]);

        for (const fund of funds) {
          const flaggedLowFee = (anomalies[fund.id] ?? []).includes('lowFee');
          const feeVal = fund.fee.value;

          // null fee: treated as 1 (> threshold), so should NOT be flagged
          if (feeVal === null) {
            if (flaggedLowFee) return false;
          } else if (feeVal <= 0.002) {
            // Must be flagged
            if (!flaggedLowFee) return false;
          } else {
            // Must NOT be flagged
            if (flaggedLowFee) return false;
          }
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
