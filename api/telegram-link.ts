// Vercel Serverless / Edge Function — Telegram wallet link code generator & shared KV store
//
// POST /api/telegram-link  { walletAddress }
//   → Generates a one-time code (ETF-XXXXXX), stores it in Redis (and in-memory fallback) for 10 min
//   → Returns { code, expiresIn: 600, expiresAt }
//
// GET  /api/telegram-link?wallet={address}
//   → Returns { linked: true, chatId } or { linked: false }
//
// DELETE /api/telegram-link?wallet={address}
//   → Removes the wallet↔chatId link

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

export const CODE_TTL = 600;       // 10 minutes validity window (seconds)
const REDIS_HOLD_TTL  = 3600;      // Keep record 60 min in Redis so bot can distinguish "expired" vs "not found"

// ─── Shared in-memory fallback store (persists across warm invocations) ──────

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

interface GlobalStore {
  kv: Map<string, MemoryEntry>;
  sets: Map<string, Set<string>>;
}

function getMemoryStore(): GlobalStore {
  const g = globalThis as unknown as { __etfsignalKvStore?: GlobalStore };
  if (!g.__etfsignalKvStore) {
    g.__etfsignalKvStore = {
      kv: new Map<string, MemoryEntry>(),
      sets: new Map<string, Set<string>>(),
    };
  }
  return g.__etfsignalKvStore;
}

// ─── Upstash Redis REST helper (supports UPSTASH_REDIS_REST_* and KV_REST_API_*) ──

function getUpstashConfig(): { url: string; token: string } | null {
  const rawUrl   = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  const url   = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '') : '';
  const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : '';
  if (!url || !token) return null;
  return { url, token };
}

export function kvAvailable(): boolean {
  return getUpstashConfig() !== null;
}

export async function upstash(command: string, ...args: (string | number)[]): Promise<any> {
  const cfg = getUpstashConfig();
  if (cfg) {
    try {
      const res = await fetch(cfg.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body:    JSON.stringify([command, ...args]),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && !data.error) {
          return data.result ?? null;
        }
      }
    } catch {
      // fall through to memory store
    }
  }

  // Fallback in-memory execution so linking works even when Upstash is unconfigured/paused
  const store = getMemoryStore();
  const cmd = command.toUpperCase();
  const key = String(args[0] ?? '');

  if (cmd === 'SET') {
    const val = String(args[1] ?? '');
    const exFlag = String(args[2] ?? '').toUpperCase();
    const ttlSec = exFlag === 'EX' ? Number(args[3] ?? 0) : 0;
    store.kv.set(key, {
      value: val,
      expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : undefined,
    });
    return 'OK';
  }

  if (cmd === 'GET') {
    const entry = store.kv.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.kv.delete(key);
      return null;
    }
    return entry.value;
  }

  if (cmd === 'DEL') {
    const existed = store.kv.delete(key);
    return existed ? 1 : 0;
  }

  if (cmd === 'SADD') {
    const member = String(args[1] ?? '');
    let set = store.sets.get(key);
    if (!set) {
      set = new Set<string>();
      store.sets.set(key, set);
    }
    const had = set.has(member);
    set.add(member);
    return had ? 0 : 1;
  }

  if (cmd === 'SREM') {
    const member = String(args[1] ?? '');
    const set = store.sets.get(key);
    if (!set) return 0;
    return set.delete(member) ? 1 : 0;
  }

  if (cmd === 'SISMEMBER') {
    const member = String(args[1] ?? '');
    const set = store.sets.get(key);
    return set?.has(member) ? 1 : 0;
  }

  if (cmd === 'SMEMBERS') {
    const set = store.sets.get(key);
    return set ? [...set] : [];
  }

  return null;
}

// Also mirror writes into memory even when Upstash succeeds so same-isolate reads are instant
async function dualSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const store = getMemoryStore();
  store.kv.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
  if (ttlSeconds) {
    await upstash('SET', key, value, 'EX', ttlSeconds);
  } else {
    await upstash('SET', key, value);
  }
}

async function dualGet(key: string): Promise<string | null> {
  const remote = await upstash('GET', key);
  if (remote !== null && remote !== undefined) {
    return String(remote);
  }
  const store = getMemoryStore();
  const entry = store.kv.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.kv.delete(key);
    return null;
  }
  return entry.value;
}

async function dualDel(key: string): Promise<void> {
  const store = getMemoryStore();
  store.kv.delete(key);
  await upstash('DEL', key);
}

export { dualSet, dualGet, dualDel };

// ─── Code generation & validation ────────────────────────────────────────────

export function generateCode(): string {
  // Unambiguous chars — no I, O, 0, 1 to avoid user confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return 'ETF-' + Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * Validates and normalizes a user-supplied link code.
 * Handles leading/trailing spaces, `/link` prefix, backticks/quotes, and lowercase input.
 * Returns normalized `ETF-XXXXXX` or `null` if invalid.
 */
export function normalizeLinkCode(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const cleaned = rawInput
    .trim()
    .replace(/^[`"'<\[\s]+|[`"'>\]\s]+$/g, '')
    .trim()
    .replace(/^\/link(?:@\S+)?\s*/i, '')
    .replace(/^[`"'<\[\s]+|[`"'>\]\s]+$/g, '')
    .trim()
    .toUpperCase();
  if (!/^ETF-[A-Z0-9]{6}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function codeKey(code: string)            { return `etfsignal:link:code:${code.toUpperCase()}`; }
export function walletKey(address: string)       { return `etfsignal:link:wallet:${address.trim().toLowerCase()}`; }
export function chatKey(chatId: string | number) { return `etfsignal:link:chat:${chatId}`; }
function walletPendingCodeKey(address: string)   { return `etfsignal:link:pending:${address.trim().toLowerCase()}`; }

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handleTelegramLinkRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // ── POST: generate a link code ────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const rawWallet = body?.walletAddress;
    if (!rawWallet || typeof rawWallet !== 'string' || !rawWallet.trim()) {
      return json({ error: 'Missing walletAddress' }, 400);
    }
    const walletAddress = rawWallet.trim();

    // Invalidate any prior unused code generated for this wallet
    const prevCode = await dualGet(walletPendingCodeKey(walletAddress));
    if (prevCode) {
      await dualDel(codeKey(prevCode));
    }

    const code      = generateCode();
    const expiresAt = Date.now() + CODE_TTL * 1000;
    const payload   = JSON.stringify({ walletAddress, expiresAt, createdAt: Date.now() });

    await Promise.all([
      dualSet(codeKey(code), payload, REDIS_HOLD_TTL),
      dualSet(walletPendingCodeKey(walletAddress), code, REDIS_HOLD_TTL),
    ]);

    return json({ code, expiresIn: CODE_TTL, expiresAt }, 200);
  }

  // ── GET: check if a wallet is linked ─────────────────────────────────────
  if (req.method === 'GET') {
    const wallet = url.searchParams.get('wallet');
    if (!wallet || !wallet.trim()) return json({ error: 'Missing wallet param' }, 400);

    const chatId = await dualGet(walletKey(wallet));
    if (chatId) {
      return json({ linked: true, chatId: String(chatId) }, 200);
    }
    return json({ linked: false }, 200);
  }

  // ── DELETE: unlink wallet ─────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const wallet = url.searchParams.get('wallet');
    if (!wallet || !wallet.trim()) return json({ error: 'Missing wallet param' }, 400);

    const chatId = await dualGet(walletKey(wallet));
    await dualDel(walletKey(wallet));
    if (chatId) await dualDel(chatKey(chatId));

    return json({ ok: true }, 200);
  }

  return json({ error: 'Method not allowed' }, 405);
}

export default async function handler(req: Request): Promise<Response> {
  return handleTelegramLinkRequest(req);
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
