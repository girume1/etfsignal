/**
 * Pure filter utility functions extracted from page components.
 * These are exported here for testability and reused in the page components.
 */

import type { NewsItem, Alert } from '../types';
import type { Density } from '../contexts/DensityContext';
import { getNewsTitle } from '../services/sosovalue';

export type FilterKind = Alert['kind'] | 'all';
export type FilterSeverity = Alert['severity'] | 'all';

// ─── News filters ─────────────────────────────────────────────────────────

/** Returns items whose English title includes the search string (case-insensitive). */
export function filterNewsBySearch(items: NewsItem[], search: string): NewsItem[] {
  const q = search.toLowerCase();
  return items.filter(n => getNewsTitle(n).toLowerCase().includes(q));
}

/** Returns items whose category matches the given category code exactly. */
export function filterNewsByCategory(items: NewsItem[], category: number): NewsItem[] {
  return items.filter(n => n.category === category);
}

// ─── Density class mapping ────────────────────────────────────────────────

/**
 * Maps a density mode to its corresponding Tailwind gap/padding class string.
 * 'comfortable' → 'gap-5 p-5'
 * 'compact'     → 'gap-4 p-4'
 * 'mobile'      → 'flex-col gap-4 p-4' (single-column layout)
 */
export function densityClasses(density: Density): string {
  if (density === 'comfortable') return 'gap-5 p-5';
  if (density === 'mobile') return 'flex-col gap-4 p-4';
  return 'gap-4 p-4';
}

// ─── Alert filters ────────────────────────────────────────────────────────

/** Returns alerts matching the combined kind and severity predicate. */
export function filterAlerts(
  alerts: Alert[],
  kind: FilterKind,
  severity: FilterSeverity,
): Alert[] {
  return alerts.filter(
    a =>
      (kind === 'all' || a.kind === kind) &&
      (severity === 'all' || a.severity === severity),
  );
}
