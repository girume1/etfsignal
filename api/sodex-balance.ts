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

      const balances: Record<string, string> = {};

      // ── Format 1: GET /balances → data.balances[{ coin, total, locked }] ─
      // SpotAccountBalances schema: coin (string), total (DecimalString), locked (DecimalString)
      if (Array.isArray(data.balances) && data.balances.length > 0) {
        for (const b of data.balances) {
          const raw = (b.coin ?? b.asset ?? b.currency ?? '') as string;
          const asset = raw.startsWith('v') ? raw.slice(1) : raw;
          if (!asset) continue;
          const total  = parseFloat(b.total  ?? b.available ?? '0');
          const locked = parseFloat(b.locked ?? '0');
          const avail  = Math.max(0, total - locked);
          balances[asset] = avail.toString();
        }
      }

      // ── Format 2: GET /state → data.B[{ a, t, l }] ───────────────────────
      // WsSpotState schema: B = WsSpotBalance[], a = asset, t = total, l = locked
      if (Object.keys(balances).length === 0 && Array.isArray(data.B) && data.B.length > 0) {
        for (const b of data.B) {
          const raw = (b.a ?? '') as string;
          const asset = raw.startsWith('v') ? raw.slice(1) : raw;
          if (!asset) continue;
          const total  = parseFloat(b.t ?? '0');
          const locked = parseFloat(b.l ?? '0');
          const avail  = Math.max(0, total - locked);
          balances[asset] = avail.toString();
        }
      }

      if (Object.keys(balances).length > 0) {
        console.log('[sodex-balance] parsed', address, balances);
        return res.json({ ok: true, balances });
      }
    } catch (err: any) {
      attempts.push({ path, error: err.message });
    }
  }

  // Log full response so we can debug exact format in Vercel logs
  console.warn('[sodex-balance] could not parse balance', address, JSON.stringify(attempts));
  return res.json({ ok: false, balances: {}, debug: attempts });
}
