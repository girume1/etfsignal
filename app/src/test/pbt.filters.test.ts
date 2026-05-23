/**
 * Property-based tests — filtering and UI invariant properties
 * Feature: etfsignal-hackathon
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import type { NewsItem, Alert } from '../types';
import { filterNewsBySearch, filterNewsByCategory, filterAlerts } from '../utils/filters';
import { getNewsTitle } from '../services/sosovalue';

// ─── Shared arbitraries ───────────────────────────────────────────────────

/**
 * Arbitrary for a single multilanguageContent entry.
 * Always includes at least one 'en' entry so getNewsTitle can find a title.
 */
const multilanguageContentArb = fc
  .tuple(
    // Guaranteed English entry
    fc.record({
      language: fc.constant('en'),
      title: fc.string(),
      content: fc.string(),
    }),
    // Optional additional entries in other languages
    fc.array(
      fc.record({
        language: fc.string({ minLength: 2, maxLength: 5 }),
        title: fc.string(),
        content: fc.string(),
      }),
      { maxLength: 3 },
    ),
  )
  .map(([enEntry, extras]) => [enEntry, ...extras]);

/** Arbitrary for a full NewsItem with at least one 'en' multilanguageContent entry. */
const newsItemArb: fc.Arbitrary<NewsItem> = fc.record({
  id: fc.string({ minLength: 1 }),
  sourceLink: fc.string(),
  releaseTime: fc.integer({ min: 0 }),
  author: fc.string(),
  category: fc.integer({ min: 0, max: 10 }),
  featureImage: fc.string(),
  matchedCurrencies: fc.array(
    fc.record({
      id: fc.string(),
      fullName: fc.string(),
      name: fc.string(),
    }),
  ),
  tags: fc.array(fc.string()),
  multilanguageContent: multilanguageContentArb,
});

/** Arbitrary for a full Alert. */
const alertArb: fc.Arbitrary<Alert> = fc.record({
  id: fc.string({ minLength: 1 }),
  kind: fc.constantFrom('inflow', 'outflow', 'rotation', 'milestone', 'anomaly') as fc.Arbitrary<Alert['kind']>,
  title: fc.string(),
  body: fc.string(),
  ticker: fc.option(fc.string(), { nil: undefined }),
  asset: fc.constantFrom('BTC', 'ETH', 'MKT') as fc.Arbitrary<Alert['asset']>,
  timestamp: fc.integer({ min: 0 }),
  severity: fc.constantFrom('low', 'med', 'high') as fc.Arbitrary<Alert['severity']>,
});

// ─── P12: News search filter correctness ─────────────────────────────────
// Validates: Requirements 7.4

describe('P12: News search filter correctness', () => {
  it('filtered result contains exactly items whose English title includes the search string (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(newsItemArb),
        (search, items) => {
          const result = filterNewsBySearch(items, search);
          const q = search.toLowerCase();

          // Every item in the result must have a title that includes the query
          const allMatch = result.every(item =>
            getNewsTitle(item).toLowerCase().includes(q),
          );

          // Every item NOT in the result must NOT have a title that includes the query
          const resultIds = new Set(result.map(item => item.id));
          const noneExcluded = items
            .filter(item => !resultIds.has(item.id))
            .every(item => !getNewsTitle(item).toLowerCase().includes(q));

          return allMatch && noneExcluded;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty search string returns all items', () => {
    fc.assert(
      fc.property(fc.array(newsItemArb), (items) => {
        const result = filterNewsBySearch(items, '');
        return result.length === items.length;
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P13: News category filter correctness ───────────────────────────────
// Validates: Requirements 7.5

describe('P13: News category filter correctness', () => {
  it('filtered result contains exactly items with category === code', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(newsItemArb),
        (category, items) => {
          const result = filterNewsByCategory(items, category);

          // Every item in the result must have the matching category
          const allMatch = result.every(item => item.category === category);

          // Every item with the matching category must be in the result
          const resultIds = new Set(result.map(item => item.id));
          const noneOmitted = items
            .filter(item => item.category === category)
            .every(item => resultIds.has(item.id));

          return allMatch && noneOmitted;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result count equals the number of items with the given category', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(newsItemArb),
        (category, items) => {
          const result = filterNewsByCategory(items, category);
          const expected = items.filter(item => item.category === category).length;
          return result.length === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── P14: Alert filter correctness ───────────────────────────────────────
// Validates: Requirements 8.3

describe('P14: Alert filter correctness', () => {
  it('filtered result matches the combined kind and severity predicate exactly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('all', 'inflow', 'outflow', 'rotation', 'milestone', 'anomaly') as fc.Arbitrary<Alert['kind'] | 'all'>,
        fc.constantFrom('all', 'low', 'med', 'high') as fc.Arbitrary<Alert['severity'] | 'all'>,
        fc.array(alertArb),
        (kind, severity, alerts) => {
          const result = filterAlerts(alerts, kind, severity);

          // Every item in the result must satisfy the combined predicate
          const allMatch = result.every(
            a =>
              (kind === 'all' || a.kind === kind) &&
              (severity === 'all' || a.severity === severity),
          );

          // Every item satisfying the predicate must be in the result
          const resultIds = new Set(result.map(a => a.id));
          const noneOmitted = alerts
            .filter(
              a =>
                (kind === 'all' || a.kind === kind) &&
                (severity === 'all' || a.severity === severity),
            )
            .every(a => resultIds.has(a.id));

          return allMatch && noneOmitted;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kind=all and severity=all returns all alerts', () => {
    fc.assert(
      fc.property(fc.array(alertArb), (alerts) => {
        const result = filterAlerts(alerts, 'all', 'all');
        return result.length === alerts.length;
      }),
      { numRuns: 100 },
    );
  });
});
