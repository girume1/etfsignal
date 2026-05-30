// Vercel Edge Function — Signal archive backed by Upstash Redis.
// Gracefully degrades to empty if Redis is not configured.
//
// GET  /api/signal-archive          → returns last 100 signals (newest first)
// POST /api/signal-archive          → saves a new signal entry
//
// Redis data structure:
//   key:  etfsignal:signal-archive  (Redis LIST, newest at index 0)

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const ARCHIVE_KEY  = 'etfsignal:signal-archive';
const MAX_SIGNALS  = 100;

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const method = req.method;

  // ── GET: return archive ───────────────────────────────────────────────────
  if (method === 'GET') {
    const raw = await upstash('LRANGE', ARCHIVE_KEY, 0, MAX_SIGNALS - 1);
    if (!Array.isArray(raw)) return json([], 200);

    const signals = raw
      .map((s: string) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean);

    return json(signals, 200);
  }

  // ── POST: save a new signal ───────────────────────────────────────────────
  if (method === 'POST') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    if (!body?.id || !body?.direction || !body?.timestamp) {
      return json({ error: 'Missing required signal fields' }, 400);
    }

    // Push to list head, then trim to cap
    const len = await upstash('LPUSH', ARCHIVE_KEY, JSON.stringify(body));
    await upstash('LTRIM', ARCHIVE_KEY, 0, MAX_SIGNALS - 1);

    return json({ ok: true, length: len }, 200);
  }

  // ── PATCH: update a signal (e.g. add real pnlPct after evaluation) ────────
  if (method === 'PATCH') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { id, pnlPct, pnlReal } = body ?? {};
    if (!id || pnlPct == null) return json({ error: 'Missing id or pnlPct' }, 400);

    // Read list, find + update the matching entry, write back
    const raw = await upstash('LRANGE', ARCHIVE_KEY, 0, MAX_SIGNALS - 1);
    if (!Array.isArray(raw)) return json({ ok: false, reason: 'Redis unavailable' }, 200);

    let updated = false;
    for (let i = 0; i < raw.length; i++) {
      try {
        const entry = JSON.parse(raw[i]);
        if (entry.id === id) {
          const patched = JSON.stringify({ ...entry, pnlPct, pnlReal: pnlReal ?? true });
          await upstash('LSET', ARCHIVE_KEY, i, patched);
          updated = true;
          break;
        }
      } catch { /* skip malformed entries */ }
    }

    return json({ ok: updated }, 200);
  }

  return json({ error: 'Method not allowed' }, 405);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
