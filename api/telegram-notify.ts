// Vercel Edge Function — Internal Signal Notification Broadcaster
// Called by the ETFSignal dashboard when a new signal is generated.
// Sends formatted alert to all Telegram subscribers.
//
// Env vars required:
//   TELEGRAM_BOT_TOKEN        — Telegram bot HTTP API token
//   TELEGRAM_NOTIFY_SECRET    — (optional) shared secret to restrict internal access
//   UPSTASH_REDIS_REST_URL    — Upstash Redis endpoint (subscriber persistence)
//   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis bearer token
//   TELEGRAM_SUBSCRIBER_IDS   — (fallback) comma-separated static chat IDs

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const SUBSCRIBERS_KEY = 'telegram:subscribers';
const DASHBOARD_URL   = 'https://etfsignalaim.vercel.app';

interface SignalNotification {
  direction:  'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss:   number;
  timeframe:  string;
  thesis:     string;
  topDriver?: string;
  asset?:     string;
}

// ─── Upstash Redis helper ────────────────────────────────────────────────────

async function upstash(command: string, ...args: (string | number)[]): Promise<any> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify([command, ...args]),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

// ─── Subscriber list resolution ──────────────────────────────────────────────
// Priority: Upstash KV set  >  static TELEGRAM_SUBSCRIBER_IDS env var
// Both sources are merged so migrating from static to dynamic is seamless.

async function getSubscriberIds(): Promise<string[]> {
  const ids = new Set<string>();

  // 1. Dynamic subscribers from Upstash Redis
  const kvMembers = await upstash('SMEMBERS', SUBSCRIBERS_KEY);
  if (Array.isArray(kvMembers)) {
    kvMembers.forEach((id: string) => ids.add(id));
  }

  // 2. Static fallback / admin-pinned IDs from env var
  const envIds = (process.env.TELEGRAM_SUBSCRIBER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  envIds.forEach((id) => ids.add(id));

  return [...ids];
}

// ─── Message formatting ──────────────────────────────────────────────────────

function buildBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}] ${pct}%`;
}

function formatSignalMessage(sig: SignalNotification): string {
  const dirEmoji: Record<string, string> = { LONG: '🟢', SHORT: '🔴', NEUTRAL: '🟡' };
  const emoji = dirEmoji[sig.direction] ?? '⚪';
  const asset = (sig.asset ?? 'BTC').toUpperCase();

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
    `_Signal via SoSoValue ETF flows + Claude AI_`,
    `[View Dashboard →](${DASHBOARD_URL})`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 500);
  }

  // Optional shared-secret guard for internal calls
  const secret = process.env.TELEGRAM_NOTIFY_SECRET;
  if (secret) {
    const authHeader = req.headers.get('x-notify-secret');
    if (authHeader !== secret) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  let body: SignalNotification;
  try {
    body = (await req.json()) as SignalNotification;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.direction || body.confidence == null || !body.entryPrice) {
    return json({ error: 'Missing required signal fields' }, 400);
  }

  const chatIds = await getSubscriberIds();

  if (chatIds.length === 0) {
    return json({ sent: 0, message: 'No subscribers' }, 200);
  }

  const message = formatSignalMessage(body);
  const results: { chatId: string; ok: boolean }[] = [];

  // Send to all subscribers concurrently
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id:                  chatId,
            text:                     message,
            parse_mode:               'Markdown',
            disable_web_page_preview: true,
          }),
        });
        results.push({ chatId, ok: res.ok });
      } catch {
        results.push({ chatId, ok: false });
      }
    }),
  );

  const successCount = results.filter((r) => r.ok).length;
  return json({ sent: successCount, total: chatIds.length, results }, 200);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
