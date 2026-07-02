// localStorage-backed fund watchlist — stores starred tickers (e.g. "IBIT").

const WATCHLIST_KEY = 'etfsignal:watchlist';

export function getWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function isWatched(ticker: string): boolean {
  return getWatchlist().includes(ticker);
}

export function toggleWatch(ticker: string): string[] {
  const current = getWatchlist();
  const next = current.includes(ticker)
    ? current.filter(t => t !== ticker)
    : [...current, ticker];
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
  return next;
}
