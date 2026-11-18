/**
 * Shared timeout budget constants between the /api/analyze Vercel function
 * and the browser analyzeMarket client so client aborts never fire before
 * the server's bounded retry loop finishes.
 */
export const AI_TOTAL_BUDGET_MS = 26_000;
export const AI_CLIENT_TIMEOUT_BUFFER_MS = 3_000;
