// Tracks which alert IDs the user has already seen (localStorage), so the
// sidebar badge can show an "unread since last visit" count instead of a
// live severity count that can silently shrink between refreshes.
// ponytail: seen IDs are only replaced (not merged) when the Alerts page is
// visited, so an alert that clears and later re-fires under the same
// deterministic ID won't re-flag as unread — acceptable for a demo app,
// revisit with timestamp-windowed tracking if that matters later.

const SEEN_KEY = 'etfsignal:alerts-seen';

export function getSeenAlertIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function markAlertsSeen(ids: string[]): void {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
}
