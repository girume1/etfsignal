// Client-side Telegram notification service
// Calls our own /api/telegram-notify edge function (which holds the bot token securely).
// This is fire-and-forget — never blocks the UI.

import type { MarketSignal } from '../types';

/**
 * Notify all configured Telegram subscribers about a newly generated signal.
 * Silently swallows errors so a Telegram outage never breaks the dashboard.
 */
export async function notifyTelegramSubscribers(
  signal: MarketSignal,
  asset: string,
): Promise<void> {
  // Map internal SignalDirection to Telegram-friendly direction labels
  const directionMap: Record<string, 'LONG' | 'SHORT' | 'NEUTRAL'> = {
    BULLISH: 'LONG',
    BEARISH: 'SHORT',
    NEUTRAL: 'NEUTRAL',
  };

  const entryPrice =
    (signal.entryZone.low + signal.entryZone.high) / 2;

  const topDriver = signal.keyFactors?.[0] ?? undefined;

  try {
    await fetch('/api/telegram-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: directionMap[signal.direction] ?? 'NEUTRAL',
        confidence: signal.confidence,
        entryPrice,
        takeProfit: signal.takeProfit.price,
        stopLoss: signal.stopLoss.price,
        timeframe: '1D',
        thesis: signal.summary || signal.tradeIdea,
        topDriver,
        asset: asset.toUpperCase(),
      }),
    });
  } catch {
    // Telegram notification failure must never surface to the user
  }
}
