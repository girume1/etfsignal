export const TOUR_SEEN_KEY = 'etfsignal:tour-seen';

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    // ignore storage errors
  }
}
