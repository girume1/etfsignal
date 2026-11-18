/**
 * One-off verification script for Kimi K3.1 Pro via NVIDIA NIM.
 *
 * Usage:
 *   node scripts/verify-nvidia-kimi.mjs
 *
 * Reads NVIDIA_API_KEY from environment or gitignored .env.local / .env / app/.env.local.
 * Never logs or echoes any secret values.
 */

import fs from 'node:fs';
import path from 'node:path';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL_ID = (process.env.NVIDIA_MODEL ?? '').trim().replace(/^["']|["']$/g, '') || 'moonshotai/kimi-k3.1-pro';

function loadKeyFromEnvFiles() {
  const existing = (process.env.NVIDIA_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (existing) return existing;

  const candidates = [
    path.resolve('.env.local'),
    path.resolve('.env'),
    path.resolve('app/.env.local'),
    path.resolve('app/.env'),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*NVIDIA_API_KEY\s*=\s*(.+?)\s*$/);
      if (match) {
        const cleaned = match[1].trim().replace(/^["']|["']$/g, '');
        if (cleaned) return cleaned;
      }
    }
  }
  return '';
}

function stripJsonFences(raw) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trim();
}

function buildRealSamplePrompt() {
  return `You are a professional crypto market analyst. Analyze the following BTC spot ETF data and recent news, then produce a structured market signal with precise TP/SL levels.

## BTC Market Data (Live)
- Current BTC Price: $96,420.5
- Total Net Assets: +121.85B
- Daily Net Inflow: +342.6M
- Cumulative Net Inflow: +41.92B
- Total BTC Holdings: 1,185,400 BTC

## Signal Track Record (last 8 real-evaluated signals)
- Hit Rate: 75%
- Avg P&L: 3.12%

## Extended Flow Context
- 30-Day Net Flow: +4.12B
- 90-Day Net Flow: +11.84B

## Top Fund Flows
  - IBIT (BlackRock): +218.4M daily inflow, fee 0.25%
  - FBTC (Fidelity): +89.2M daily inflow, fee 0.25%
  - ARKB (ARK 21Shares): +38.5M daily inflow, fee 0.21%
  - GBTC (Grayscale): -34.6M daily inflow, fee 1.50%
  - BITB (Bitwise): +21.7M daily inflow, fee 0.20%

## Recent News Headlines
  - [1] US Spot Bitcoin ETFs Record $342M Net Inflow Led by BlackRock IBIT and Fidelity FBTC
  - [2] Institutional BTC ETF Holdings Surpass 1.18M BTC as 30-Day Moving Average Turns Positive

## Your Task
Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": <integer 0-100>,
  "headline": "<one punchy sentence, max 12 words>",
  "summary": "<2-3 sentences explaining the signal with specific numbers>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "tradeIdea": "<specific, actionable suggestion referencing SoDEX>",
  "riskWarning": "<one sentence about the main risk to this thesis>",
  "entryZone": {
    "low": <number — lower bound of optimal entry price in USD>,
    "high": <number — upper bound of optimal entry price in USD>
  },
  "takeProfit": {
    "price": <number — target price in USD, realistic based on technicals and flow momentum>,
    "pct": <number — percentage gain from current price, e.g. 4.5 for +4.5%>,
    "rationale": "<one sentence: key resistance level or flow target that justifies this price>"
  },
  "stopLoss": {
    "price": <number — stop price in USD, realistic risk management level>,
    "pct": <number — percentage loss from current price, e.g. -2.8 for -2.8%>,
    "rationale": "<one sentence: support level or flow breakdown point that invalidates the thesis>"
  },
  "weights": [
    { "factor": "ETF Daily Inflow", "weight": <integer>, "signal": "positive" | "negative" | "neutral" },
    { "factor": "Cumulative Flow Trend", "weight": <integer>, "signal": "positive" | "negative" | "neutral" },
    { "factor": "News Sentiment", "weight": <integer>, "signal": "positive" | "negative" | "neutral" },
    { "factor": "Fund Concentration", "weight": <integer>, "signal": "positive" | "negative" | "neutral" }
  ]
}

The "weights" array must contain exactly 4 entries. Each weight is an integer. All 4 weights must sum to exactly 100. The "signal" field reflects whether that factor is contributing positively, negatively, or neutrally to the overall direction.`;
}

async function callNim(apiKey, payload, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - t0;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-json response
    }
    return { status: res.status, ok: res.ok, elapsedMs, json, rawText: text };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      elapsedMs: Date.now() - t0,
      error: err?.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : (err?.message ?? String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const apiKey = loadKeyFromEnvFiles();
  if (!apiKey) {
    console.error('[verify-nvidia-kimi] NVIDIA_API_KEY not found in env or .env.local.');
    console.error('Pull Vercel env locally or add NVIDIA_API_KEY to a gitignored .env.local, e.g.:');
    console.error('  npx vercel env pull .env.local');
    process.exit(1);
  }

  console.log(`Target endpoint: ${NVIDIA_API_URL}`);
  console.log(`Target model:    ${MODEL_ID}`);
  console.log('Key present:     true (value masked)');

  // 1. Model acceptance smoke check
  const check1 = await callNim(apiKey, {
    model: MODEL_ID,
    messages: [{ role: 'user', content: 'Respond with JSON: {"ok":true}' }],
    max_tokens: 256,
    temperature: 0.2,
    stream: false,
  });
  console.log('\n[1] Model acceptance check:', {
    status: check1.status,
    ok: check1.ok,
    elapsedMs: check1.elapsedMs,
    hasContent: Boolean(check1.json?.choices?.[0]?.message?.content),
    hasReasoning: Boolean(check1.json?.choices?.[0]?.message?.reasoning_content),
    error: check1.error ?? check1.json?.error?.message ?? (!check1.ok ? check1.rawText?.slice(0, 180) : undefined),
  });

  // 2. Real buildPrompt latency + MarketSignal JSON schema test
  const check2 = await callNim(apiKey, {
    model: MODEL_ID,
    messages: [{ role: 'user', content: buildRealSamplePrompt() }],
    max_tokens: 2048,
    temperature: 0.2,
    stream: false,
  });
  const content = check2.json?.choices?.[0]?.message?.content ?? '';
  const reasoning = check2.json?.choices?.[0]?.message?.reasoning_content ?? '';
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch (err) {
    parseError = err?.message ?? 'JSON parse error';
  }
  const requiredKeys = ['direction', 'confidence', 'headline', 'summary', 'keyFactors', 'tradeIdea', 'riskWarning', 'entryZone', 'takeProfit', 'stopLoss', 'weights'];
  const missingKeys = parsed ? requiredKeys.filter((k) => parsed[k] === undefined) : requiredKeys;
  const weightsSum = Array.isArray(parsed?.weights) ? parsed.weights.reduce((s, w) => s + Number(w?.weight ?? 0), 0) : null;

  console.log('\n[2] Real buildPrompt test:', {
    status: check2.status,
    ok: check2.ok,
    elapsedMs: check2.elapsedMs,
    usage: check2.json?.usage ?? null,
    contentLength: content.length,
    reasoningLength: reasoning.length,
    cleanJsonParsed: Boolean(parsed),
    parseError,
    missingKeys,
    weightsSum,
  });

  // 3. Probe optional parameters: response_format json_object & thinking toggle
  const checkJsonMode = await callNim(apiKey, {
    model: MODEL_ID,
    messages: [{ role: 'user', content: 'Return JSON {"status":"ok"}' }],
    max_tokens: 256,
    temperature: 0.2,
    stream: false,
    response_format: { type: 'json_object' },
  }, 15_000);

  const checkThinkingOff = await callNim(apiKey, {
    model: MODEL_ID,
    messages: [{ role: 'user', content: 'Return JSON {"status":"ok"}' }],
    max_tokens: 256,
    temperature: 0.2,
    stream: false,
    chat_template_kwargs: { thinking: false },
  }, 15_000);

  console.log('\n[3] Optional parameter probes:', {
    response_format_json_object: {
      accepted: checkJsonMode.ok,
      status: checkJsonMode.status,
      elapsedMs: checkJsonMode.elapsedMs,
      error: !checkJsonMode.ok ? (checkJsonMode.json?.detail ?? checkJsonMode.json?.error?.message ?? checkJsonMode.rawText?.slice(0, 160)) : undefined,
    },
    chat_template_kwargs_thinking_false: {
      accepted: checkThinkingOff.ok,
      status: checkThinkingOff.status,
      elapsedMs: checkThinkingOff.elapsedMs,
      reasoningLength: checkThinkingOff.json?.choices?.[0]?.message?.reasoning_content?.length ?? 0,
      error: !checkThinkingOff.ok ? (checkThinkingOff.json?.detail ?? checkThinkingOff.json?.error?.message ?? checkThinkingOff.rawText?.slice(0, 160)) : undefined,
    },
  });
}

main().catch((err) => {
  console.error('[verify-nvidia-kimi] Fatal error:', err?.message ?? err);
  process.exit(1);
});
