// Vercel Node.js Serverless Function — proxies SoSoValue API calls so the key never reaches the browser.
// Node.js runtime (not edge) so it can reach any upstream host without network restrictions.

const ALLOWED_HOSTS = ['api.sosovalue.xyz', 'openapi.sosovalue.com'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SOSOVALUE_API_KEY not configured' });
  }

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

  try {
    const upstream = await fetch(target.toString(), {
      method: method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-soso-api-key': apiKey,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await upstream.json().catch(() => ({ error: upstream.statusText }));

    if (!upstream.ok) {
      // Pass through the real status + body so client can see the actual SoSoValue error
      return res.status(upstream.status).json({
        error: `SoSoValue ${upstream.status}`,
        upstream: data,
      });
    }

    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Fetch failed' });
  }
}
