// Vercel Edge Function — Telegram wallet link code generator
//
// POST /api/telegram-link  { walletAddress }
//   → Generates a one-time code (ETF-XXXXXX), stores it in Redis for 10 min
//   → Returns { code, expiresIn: 600 }
//
// GET  /api/telegram-link?wallet={address}
//   → Returns { linked: true, chatId } or { linked: false }
//
// DELETE /api/telegram-link?wallet={address}
//   → Removes the wallet↔chatId link

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const CODE_TTL = 600; // 10 minutes in seconds

// ─── Upstash helper ───────────────────────────────────────────────────────────

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

// ─── Code generation ──────────────────────────────────────────────────────────

function generateCode(): string {
  // Unambiguous chars — no I, O, 0, 1 to avoid user confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return 'ETF-' + Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

function codeKey(code: string)            { return `etfsignal:link:code:${code}`; }
function walletKey(address: string)       { return `etfsignal:link:wallet:${address.toLowerCase()}`; }
function chatKey(chatId: string | number) { return `etfsignal:link:chat:${chatId}`; }

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // ── POST: generate a link code ────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { walletAddress } = body ?? {};
    if (!walletAddress || typeof walletAddress !== 'string') {
      return json({ error: 'Missing walletAddress' }, 400);
    }

    const code    = generateCode();
    const payload = JSON.stringify({ walletAddress, expiresAt: Date.now() + CODE_TTL * 1000 });

    // Store code with TTL in Redis
    await upstash('SET', codeKey(code), payload, 'EX', CODE_TTL);

    return json({ code, expiresIn: CODE_TTL }, 200);
  }

  // ── GET: check if a wallet is linked ─────────────────────────────────────
  if (req.method === 'GET') {
    const wallet = url.searchParams.get('wallet');
    if (!wallet) return json({ error: 'Missing wallet param' }, 400);

    const chatId = await upstash('GET', walletKey(wallet));
    if (chatId) {
      return json({ linked: true, chatId: String(chatId) }, 200);
    }
    return json({ linked: false }, 200);
  }

  // ── DELETE: unlink wallet ─────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const wallet = url.searchParams.get('wallet');
    if (!wallet) return json({ error: 'Missing wallet param' }, 400);

    const chatId = await upstash('GET', walletKey(wallet));
    await upstash('DEL', walletKey(wallet));
    if (chatId) await upstash('DEL', chatKey(chatId));

    return json({ ok: true }, 200);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Exported helpers (used by api/telegram.ts and api/telegram-notify.ts) ───

export { walletKey, chatKey, codeKey };

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
