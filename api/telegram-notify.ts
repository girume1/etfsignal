// Vercel Edge Function — Internal Signal Notification Broadcaster
// Called by the ETFSignal dashboard when a new signal is generated.
// Sends formatted alert to all configured Telegram subscribers.
//
// Env vars required:
//   TELEGRAM_BOT_TOKEN  — bot HTTP API token
//   TELEGRAM_SUBSCRIBER_IDS — comma-separated chat IDs, e.g. "123456789,987654321"

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

interface SignalNotification {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  timeframe: string;
  thesis: string;
  topDriver?: string;
  asset?: string;
}

function buildBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}] ${pct}%`;
}

function formatSignalMessage(sig: SignalNotification): string {
  const dirEmoji: Record<string, string> = { LONG: '🟢', SHORT: '🔴', NEUTRAL: '🟡' };
  const emoji = dirEmoji[sig.direction] ?? '⚪';
  const asset = sig.asset ?? 'BTC';

  return [
    `🚨 *New ETFSignal AI Alert*`,
    ``,
    `${emoji} *${sig.direction} ${asset}* | ${sig.timeframe}`,
    `Confidence: ${buildBar(sig.confidence)}`,
    ``,
    `💰 *Entry:* $${Number(sig.entryPrice).toLocaleString()}`,
    `🎯 *TP:* $${Number(sig.takeProfit).toLocaleString()}`,
    `🛑 *SL:* $${Number(sig.stopLoss).toLocaleString()}`,
    sig.topDriver ? `\n📊 *Driver:* ${sig.topDriver}` : '',
    ``,
    `💡 ${sig.thesis}`,
    ``,
    `_Signal generated via SoSoValue ETF flows + Claude AI_`,
    `[View Full Dashboard →](https://etfsignalaim.vercel.app)`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const subscriberIds = process.env.TELEGRAM_SUBSCRIBER_IDS ?? '';

  if (!botToken) {
    return json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 500);
  }

  // Optional: restrict to internal calls using a shared secret
  const secret = process.env.TELEGRAM_NOTIFY_SECRET;
  if (secret) {
    const authHeader = req.headers.get('x-notify-secret');
    if (authHeader !== secret) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  let body: SignalNotification;
  try {
    body = await req.json() as SignalNotification;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.direction || !body.confidence || !body.entryPrice) {
    return json({ error: 'Missing required signal fields' }, 400);
  }

  const chatIds = subscriberIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    return json({ sent: 0, message: 'No subscribers configured' }, 200);
  }

  const message = formatSignalMessage(body);
  const results: { chatId: string; ok: boolean }[] = [];

  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      results.push({ chatId, ok: res.ok });
    } catch {
      results.push({ chatId, ok: false });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  return json({ sent: successCount, total: chatIds.length, results }, 200);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
