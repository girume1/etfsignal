// Vercel Node.js Serverless Function — SoDEX balance proxy
// Fetches wallet balance from SoDEX testnet API server-side (avoids CORS).
// Logs the raw response so we can diagnose format differences.
//
// GET /api/sodex-balance?address=0x...

const TESTNET_GW = 'https://testnet-gw.sodex.dev/api/v1/spot';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing address param' });
  }

  const paths = [
    `/accounts/${address}/balances`,
    `/accounts/${address}/state`,
  ];

  const attempts: any[] = [];

  for (const path of paths) {
    try {
      const r = await fetch(`${TESTNET_GW}${path}`, {
        headers: { 'Accept': 'application/json' },
      });
      const text = await r.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch { /* non-JSON */ }

      attempts.push({ path, status: r.status, body });

      if (!r.ok || body?.code !== 0) continue;

      const data = body.data;
      if (!data) continue;

      // ── Format 1: array at data.balances / data.assets / data.list ──────
      const list: any[] = data.balances ?? data.assets ?? data.list ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const balances: Record<string, string> = {};
        for (const b of list) {
          const raw = (b.asset ?? b.currency ?? b.coin ?? b.symbol ?? '') as string;
          const asset = raw.startsWith('v') ? raw.slice(1) : raw;
          if (!asset) continue;
          balances[asset] = String(b.available ?? b.free ?? b.avail ?? b.balance ?? '0');
        }
        if (Object.keys(balances).length > 0) {
          console.log('[sodex-balance] parsed (list)', address, balances);
          return res.json({ ok: true, balances });
        }
      }

      // ── Format 2: flat key-value object directly in data ─────────────────
      if (typeof data === 'object' && !Array.isArray(data)) {
        const balances: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'string' || typeof v === 'number') {
            const asset = k.startsWith('v') ? k.slice(1) : k;
            balances[asset] = String(v);
          }
        }
        if (Object.keys(balances).length > 0) {
          console.log('[sodex-balance] parsed (flat)', address, balances);
          return res.json({ ok: true, balances });
        }
      }
    } catch (err: any) {
      attempts.push({ path, error: err.message });
    }
  }

  // Log full response so we can debug exact format in Vercel logs
  console.warn('[sodex-balance] could not parse balance', address, JSON.stringify(attempts));
  return res.json({ ok: false, balances: {}, debug: attempts });
}
