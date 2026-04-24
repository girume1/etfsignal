/// <reference types="node" />
// Vercel Edge Function — proxies SoSoValue API calls so the key never reaches the browser.
// Client POSTs { method, url, body?, params? } → this function forwards with the server key.

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = ['api.sosovalue.xyz', 'openapi.sosovalue.com'];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) {
    return json({ noKey: true }, 200);
  }

  interface ProxyBody {
    method: string;
    url: string;
    body?: unknown;
    params?: Record<string, string>;
  }

  let payload: ProxyBody;
  try {
    payload = await req.json() as ProxyBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { method, url, body, params } = payload;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return json({ error: 'Invalid URL' }, 400);
  }
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return json({ error: 'Forbidden host' }, 403);
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
  }

  const upstream = await fetch(target.toString(), {
    method: method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-soso-api-key': apiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await upstream.json();
  return json(data, upstream.status);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
