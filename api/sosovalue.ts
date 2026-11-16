// Vercel Node.js Serverless Function — proxies SoSoValue API calls so the key never reaches the browser.
// Node.js runtime (not edge) so it can reach any upstream host without network restrictions.

const ALLOWED_HOSTS = [
  'api.sosovalue.xyz',
  'openapi.sosovalue.com',
  'api.sosovalue.com',
  'sosovalue.com',
];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKey = process.env.SOSO_API_KEY ?? process.env.SOSOVALUE_API_KEY;
  if (!rawKey || !rawKey.trim()) {
    return res.status(500).json({ error: 'SOSO_API_KEY not configured' });
  }
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  const { method, url, body, params } = req.body ?? {};

  if (!url) return res.status(400).json({ error: 'Missing url' });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return res.status(403).json({ error: 'Forbidden host' });
  }

  if (params) {
    Object.entries(params as Record<string, unknown>).forEach(([k, v]) =>
      target.searchParams.set(k, String(v))
    );
  }

  const altHost = target.hostname === 'openapi.sosovalue.com'
    ? 'api.sosovalue.xyz'
    : 'openapi.sosovalue.com';
  const altUrl = new URL(target.toString());
  altUrl.hostname = altHost;

  let lastStatus = 500;
  let lastData: unknown = { error: 'Fetch failed' };

  for (const candidateUrl of [target.toString(), altUrl.toString()]) {
    try {
      const upstream = await fetch(candidateUrl, {
        method: method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ETFSignalAI/1.0 (+https://etfsignal.vercel.app)',
          'x-soso-api-key': apiKey,
          'X-API-KEY': apiKey,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const data = await upstream.json().catch(() => ({ error: upstream.statusText }));
      lastStatus = upstream.status;
      lastData = data;

      if (upstream.ok) {
        return res.status(upstream.status).json(data);
      }
    } catch (err: any) {
      lastData = { error: err?.message ?? 'Fetch failed' };
    }
  }

  return res.status(lastStatus).json({
    error: `SoSoValue ${lastStatus}`,
    upstream: lastData,
  });
}
