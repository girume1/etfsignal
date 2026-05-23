#!/usr/bin/env node
// Lightweight local API proxy for ETFSignal AI development.
// Mimics the Vercel Edge Functions in api/ without needing vercel dev.
//
// Usage (from project root):
//   node dev-proxy.js
//
// Then in app/:
//   pnpm dev
//
// Reads API keys from .env.local in this directory.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && val && !process.env[key]) process.env[key] = val;
    }
  } catch { /* file not found — keys already in env */ }
}
loadEnv(path.join(__dirname, '.env.local'));

const SOSOVALUE_KEY = process.env.SOSOVALUE_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const PORT = parseInt(process.env.PROXY_PORT || '3000', 10);

// ── Helpers ──────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function fetchUrl(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

// ── Route handlers ───────────────────────────────────────────────────────────
async function handleSosovalue(req, res) {
  if (!SOSOVALUE_KEY) return json(res, 500, { error: 'SOSOVALUE_API_KEY not set in .env.local' });

  const rawBody = await readBody(req);
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { method, url, body: reqBody, params } = payload;

  let targetUrl;
  try { targetUrl = new URL(url); } catch { return json(res, 400, { error: 'Invalid URL' }); }

  const ALLOWED = ['api.sosovalue.xyz', 'openapi.sosovalue.com'];
  if (!ALLOWED.includes(targetUrl.hostname)) return json(res, 403, { error: 'Forbidden host' });

  if (params) {
    Object.entries(params).forEach(([k, v]) => targetUrl.searchParams.set(k, String(v)));
  }

  try {
    const upstream = await fetchUrl(targetUrl.toString(), {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-soso-api-key': SOSOVALUE_KEY,
      },
      body: reqBody !== undefined ? JSON.stringify(reqBody) : undefined,
    });
    let parsed;
    try { parsed = JSON.parse(upstream.body); } catch { parsed = { raw: upstream.body }; }
    json(res, upstream.status || 200, parsed);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

async function handleAnalyze(req, res) {
  if (!ANTHROPIC_KEY) return json(res, 500, { error: 'ANTHROPIC_API_KEY not set in .env.local' });

  const rawBody = await readBody(req);
  try {
    const upstream = await fetchUrl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: rawBody,
    });
    let parsed;
    try { parsed = JSON.parse(upstream.body); } catch { parsed = { raw: upstream.body }; }
    json(res, upstream.status || 200, parsed);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  try {
    if (req.url === '/api/sosovalue' && req.method === 'POST') return await handleSosovalue(req, res);
    if (req.url === '/api/analyze'   && req.method === 'POST') return await handleAnalyze(req, res);
    json(res, 404, { error: `No handler for ${req.method} ${req.url}` });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 ETFSignal dev proxy → http://localhost:${PORT}`);
  console.log(`   SOSOVALUE_API_KEY : ${SOSOVALUE_KEY ? '✅ loaded' : '❌ missing'}`);
  console.log(`   ANTHROPIC_API_KEY : ${ANTHROPIC_KEY ? '✅ loaded' : '❌ missing'}`);
  console.log('\n   Keep this running, then do: pnpm dev (in app/ folder)\n');
});
