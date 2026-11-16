// Vercel Edge Function — Telegram Bot Webhook Handler
// Bot: @ETFSignalAIBot | t.me/ETFSignalAIBot
//
// Env vars required:
//   TELEGRAM_BOT_TOKEN        — Telegram bot HTTP API token
//   GEMINI_API_KEY            — Google Gemini AI key (for /signal)
//   SOSO_API_KEY              — SoSoValue ETF data key (for /status & /signal)
//   UPSTASH_REDIS_REST_URL    — Upstash Redis endpoint (for subscriber persistence)
//   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis bearer token
//   ETHERSCAN_API_KEY         — (optional) Etherscan key for higher gas API rate limits

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

import {
  upstash,
  kvAvailable,
  dualGet,
  dualSet,
  dualDel,
  normalizeLinkCode,
  codeKey,
  walletKey,
  chatKey,
  handleTelegramLinkRequest,
} from './telegram-link';
import { handleTelegramNotifyRequest } from './telegram-notify';

const TELEGRAM_API     = 'https://api.telegram.org';
const SOSO_PRIMARY     = 'https://openapi.sosovalue.com';
const SOSO_FALLBACK    = 'https://api.sosovalue.xyz';
const SUBSCRIBERS_KEY  = 'telegram:subscribers';
const DASHBOARD_URL    = 'https://etfsignal.vercel.app';

// Binance symbol mapping
const CHART_SYMBOLS: Record<string, { symbol: string; label: string }> = {
  btc:  { symbol: 'BTCUSDT',  label: 'BTC/USDT' },
  eth:  { symbol: 'ETHUSDT',  label: 'ETH/USDT' },
  btcp: { symbol: 'BTCUSDT',  label: 'BTC PERP' },
  ethp: { symbol: 'ETHUSDT',  label: 'ETH PERP' },
};

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
): Promise<number | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:                  chatId,
        text,
        parse_mode:               parseMode,
        disable_web_page_preview: true,
      }),
    });
    const data: any = await res.json().catch(() => null);
    if (res.ok) {
      return typeof data?.result?.message_id === 'number' ? data.result.message_id : null;
    }
    const desc = String(data?.description ?? '').toLowerCase();
    if (desc.includes("can't parse entities")) {
      const plainRes = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:                  chatId,
          text:                     text.replace(/[*_`[\]]/g, ''),
          disable_web_page_preview: true,
        }),
      });
      const plainData: any = await plainRes.json().catch(() => null);
      return typeof plainData?.result?.message_id === 'number' ? plainData.result.message_id : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function sendTyping(token: string, chatId: number | string) {
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch { /* ignore typing errors */ }
}

// ─── Telegram: send photo from URL ───────────────────────────────────────────

async function sendPhotoFromUrl(
  token:   string,
  chatId:  number | string,
  photoUrl: string,
  caption?: string,
) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:   chatId,
      photo:     photoUrl,
      caption:   caption ?? '',
      parse_mode: 'Markdown',
    }),
  });
}

// Send binary image data (ArrayBuffer) as a Telegram photo using multipart/form-data
async function sendPhotoBuffer(
  token:    string,
  chatId:   number | string,
  buf:      ArrayBuffer,
  caption?: string,
  replyMarkup?: unknown,
) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([buf], { type: 'image/png' }), 'chart.png');
  if (caption)     form.append('caption',      caption);
  if (caption)     form.append('parse_mode',   'Markdown');
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

  await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, {
    method: 'POST',
    body:   form,
  });
}

// Edit an existing text message (used by progress updates and callback_query Refresh).
// Safely handles "message is not modified" and returns true if edited or unchanged, false if uneditable.
export async function editMessage(
  token:     string,
  chatId:    number | string,
  messageId: number,
  text:      string,
  replyMarkup?: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:                  chatId,
        message_id:               messageId,
        text,
        parse_mode:               'Markdown',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    if (res.ok) return true;
    const errJson: any = await res.json().catch(() => ({}));
    const desc = String(errJson?.description ?? '').toLowerCase();
    if (desc.includes('message is not modified')) {
      return true;
    }
    if (desc.includes("can't parse entities")) {
      const plainRes = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:                  chatId,
          message_id:               messageId,
          text:                     text.replace(/[*_`[\]]/g, ''),
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
      if (plainRes.ok) return true;
      const plainErr: any = await plainRes.json().catch(() => ({}));
      return String(plainErr?.description ?? '').toLowerCase().includes('message is not modified');
    }
    return false;
  } catch {
    return false;
  }
}

async function answerCallback(token: string, callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ─── Gas price fetcher ────────────────────────────────────────────────────────

interface GasData {
  safe:     string;
  proposed: string;
  fast:     string;
  baseFee:  string;
}

// Public Ethereum RPC endpoints — no API key required, free, multiple fallbacks
const ETH_RPC_NODES = [
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
];

async function fetchGasPrice(): Promise<GasData | null> {
  for (const rpc of ETH_RPC_NODES) {
    try {
      // eth_feeHistory: last 4 blocks, reward percentiles 25/50/75
      const res = await fetch(rpc, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'eth_feeHistory',
          params:  ['0x4', 'latest', [25, 50, 75]],
        }),
      });
      if (!res.ok) continue;

      const json: any = await res.json();
      const result = json?.result;
      if (!result?.baseFeePerGas || !result?.reward) continue;

      // Second-to-last baseFee is the current confirmed block (last is "next" prediction)
      const bases  = result.baseFeePerGas as string[];
      const baseFee = parseInt(bases[bases.length - 2], 16) / 1e9;

      // Average priority fees across blocks for each percentile
      const rewards = result.reward as string[][];
      const avgPriority = (idx: number) =>
        rewards.reduce((sum: number, r: string[]) => sum + parseInt(r[idx], 16), 0)
        / rewards.length / 1e9;

      const safe     = baseFee + avgPriority(0);  // 25th percentile
      const proposed = baseFee + avgPriority(1);  // 50th percentile
      const fast     = baseFee + avgPriority(2);  // 75th percentile

      return {
        safe:     safe.toFixed(3),
        proposed: proposed.toFixed(3),
        fast:     fast.toFixed(3),
        baseFee:  baseFee.toFixed(4),
      };
    } catch { /* try next RPC */ }
  }
  return null;
}

function formatGasMessage(gas: GasData): string {
  return [
    `⛽ *Ethereum Gas Prices*`,
    ``,
    `🛡 Safe:     *${gas.safe} Gwei*`,
    `🚗 Proposed: *${gas.proposed} Gwei*`,
    `🚀 Fast:     *${gas.fast} Gwei*`,
    `📊 Base Fee: *${gas.baseFee} Gwei*`,
    ``,
    `_${new Date().toUTCString()}_`,
  ].join('\n');
}

const GAS_REFRESH_KEYBOARD = {
  inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'gas_refresh' }]],
};

async function subscriberAdd(chatId: string)      { return upstash('SADD',      SUBSCRIBERS_KEY, chatId); }
async function subscriberRemove(chatId: string)   { return upstash('SREM',      SUBSCRIBERS_KEY, chatId); }
async function subscriberExists(chatId: string)   {
  const r = await upstash('SISMEMBER', SUBSCRIBERS_KEY, chatId);
  return r === 1;
}

// ─── SoSoValue data helpers ───────────────────────────────────────────────────

interface EtfSnapshot {
  totalAum:    number | null;
  dailyInflow: number | null;
  cumInflow:   number | null;
  topFunds:    Array<{ ticker: string; inflow: number }>;
}

async function fetchEtfSnapshot(type: 'us-btc-spot' | 'us-eth-spot'): Promise<EtfSnapshot | null> {
  const rawKey = process.env.SOSO_API_KEY ?? process.env.SOSOVALUE_API_KEY;
  const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : '';
  if (!apiKey) return null;

  for (const base of [SOSO_PRIMARY, SOSO_FALLBACK]) {
    try {
      const res = await fetchWithTimeout(
        `${base}/openapi/v2/etf/currentEtfDataMetrics`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-soso-api-key': apiKey },
          body:    JSON.stringify({ type }),
        },
        4000,
      );
      if (!res.ok) continue;

      const json: any = await res.json();
      if (json.code !== 0 || !json.data) continue;

      const d = json.data;
      const toNum = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const topFunds: Array<{ ticker: string; inflow: number }> = (d.list ?? [])
        .filter((f: any) => (toNum(f.dailyNetInflow?.value) ?? 0) > 0)
        .sort((a: any, b: any) => (toNum(b.dailyNetInflow?.value) ?? 0) - (toNum(a.dailyNetInflow?.value) ?? 0))
        .slice(0, 3)
        .map((f: any) => ({ ticker: f.ticker, inflow: toNum(f.dailyNetInflow?.value) ?? 0 }));

      return {
        totalAum:    toNum(d.totalNetAssets?.value),
        dailyInflow: toNum(d.dailyNetInflow?.value),
        cumInflow:   toNum(d.cumNetInflow?.value),
        topFunds,
      };
    } catch { /* try next host */ }
  }
  return null;
}

// Fetch 24-hr ticker from Binance (price + percent change)
async function fetchBinanceTicker(symbol: 'BTCUSDT' | 'ETHUSDT'): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      {},
      4000,
    );
    if (!res.ok) return null;
    const d: any = await res.json();
    return {
      price:     parseFloat(d.lastPrice      ?? '0'),
      changePct: parseFloat(d.priceChangePercent ?? '0'),
    };
  } catch {
    return null;
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

function fmtUSD(v: number | null): string {
  if (v === null) return '—';
  const abs  = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtAUM(v: number | null): string {
  if (v === null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  return `$${abs.toFixed(0)}`;
}

function confBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}] ${pct}%`;
}

// ─── Signal generation (The Agent + live SoSoValue data) ─────────────────────
// Routes through /api/analyze (Node.js proxy) — same path the web dashboard uses.

async function generateSignal(
  asset: 'BTC' | 'ETH',
  baseUrl: string,
  onProgress?: (stageText: string) => Promise<void>,
): Promise<string> {
  const etfType = asset === 'BTC' ? 'us-btc-spot' : 'us-eth-spot';
  const binSym  = asset === 'BTC' ? 'BTCUSDT'     : 'ETHUSDT';

  if (onProgress) {
    await onProgress(`📊 *Fetching institutional ${asset} ETF data...*`);
  }

  // Fetch ETF data + live price in parallel
  const [snap, ticker] = await Promise.all([
    fetchEtfSnapshot(etfType),
    fetchBinanceTicker(binSym),
  ]);

  if (onProgress) {
    await onProgress(`🧠 *Synthesizing the ${asset} market signal...*`);
  }

  // Build data section for the prompt
  const rows: string[] = [];
  if (snap?.totalAum    != null) rows.push(`Total ${asset} ETF AUM: ${fmtAUM(snap.totalAum)}`);
  if (snap?.dailyInflow != null) rows.push(`Today's Net Inflow: ${fmtUSD(snap.dailyInflow)}`);
  if (snap?.cumInflow   != null) rows.push(`Cumulative Net Inflow: ${fmtAUM(snap.cumInflow)}`);
  if (snap?.topFunds.length)     rows.push(`Top Fund: ${snap.topFunds[0].ticker} (${fmtUSD(snap.topFunds[0].inflow)})`);
  if (ticker?.price)             rows.push(`${asset} Price: $${ticker.price.toLocaleString()} (${ticker.changePct >= 0 ? '+' : ''}${ticker.changePct.toFixed(2)}% 24h)`);

  const dataSection = rows.length
    ? rows.join('\n')
    : '(Live data unavailable — use current market knowledge)';

  const prompt = `You are an expert crypto ETF trading analyst. Analyze this real-time market data and generate a structured trading signal for ${asset}.

Market Data (${new Date().toUTCString()}):
${dataSection}

Respond with ONLY a JSON object (no markdown, no extra text):
{
  "direction": "LONG" | "SHORT" | "NEUTRAL",
  "confidence": <integer 0-100>,
  "entryPrice": <number>,
  "takeProfit": <number>,
  "stopLoss": <number>,
  "timeframe": "4H" | "1D" | "1W",
  "thesis": "<2 sentence reasoning>",
  "topDriver": "<single strongest factor driving this signal>"
}`;

  // Call the /api/analyze proxy (Node.js, not Edge) — same endpoint the dashboard uses
  const aiRes = await fetchWithTimeout(
    `${baseUrl}/api/analyze`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 512,
        messages:   [{ role: 'user', content: prompt }],
      }),
    },
    25_000,
  ).catch((err: any) => {
    if (err?.name === 'AbortError') {
      throw new Error('The Agent timed out waiting for Gemini. Please try again.');
    }
    throw err;
  });

  if (!aiRes.ok) {
    const errBody: any = await aiRes.json().catch(() => ({}));
    throw new Error(errBody?.error || `Agent API error: ${aiRes.status}`);
  }

  const aiData: any  = await aiRes.json();
  const raw: string  = aiData?.content?.[0]?.text?.trim() ?? '';

  let sig: any;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    sig = JSON.parse(clean);
  } catch {
    throw new Error('Failed to parse signal JSON from The Agent');
  }

  const dirEmoji: Record<string, string> = { LONG: '🟢', SHORT: '🔴', NEUTRAL: '🟡' };
  const emoji = dirEmoji[sig.direction] ?? '⚪';

  return [
    `📡 *The Agent — ${asset} Market Intelligence*`,
    ``,
    `${emoji} *${sig.direction}* | Confidence: ${sig.confidence}%`,
    confBar(sig.confidence),
    ``,
    `💰 *Entry:* $${Number(sig.entryPrice).toLocaleString()}`,
    `🎯 *Take Profit:* $${Number(sig.takeProfit).toLocaleString()}`,
    `🛑 *Stop Loss:* $${Number(sig.stopLoss).toLocaleString()}`,
    `⏱ *Timeframe:* ${sig.timeframe}`,
    ``,
    `📊 *Key Driver:* ${sig.topDriver}`,
    ``,
    `💡 *Agent Analysis:* ${sig.thesis}`,
    ``,
    snap ? `_SoSoValue ETF flows · The Agent · SoDEX_` : `_The Agent · SoDEX_`,
    `[View Dashboard](${DASHBOARD_URL})`,
  ].join('\n');
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleGas(token: string, chatId: number) {
  await sendTyping(token, chatId);
  const gas = await fetchGasPrice();
  if (!gas) {
    await sendMessage(token, chatId, '❌ *Gas price unavailable.* Etherscan API may be rate limited — try again shortly.');
    return;
  }
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:      chatId,
      text:         formatGasMessage(gas),
      parse_mode:   'Markdown',
      reply_markup: GAS_REFRESH_KEYBOARD,
    }),
  });
}

// cmd maps to the key in EXCHANGE_URLS inside api/chart.ts
// When SCREENSHOTONE_ACCESS_KEY is set → screenshots exchange site
// Otherwise                           → QuickChart candlestick from OHLC data
async function handleChart(
  token:    string,
  chatId:   number,
  cmd:      string,   // ch | chb | che | tv_btc | tv_eth (maps to EXCHANGE_URLS)
  assetKey: string,   // btc | eth | btcp | ethp (for QuickChart fallback)
  interval: string,   // 1m | 1h
  baseUrl:  string,
) {
  const info = CHART_SYMBOLS[assetKey] ?? CHART_SYMBOLS.btc;
  await sendTyping(token, chatId);

  try {
    // Try screenshot mode first (if key configured), then OHLC fallback
    const url = `${baseUrl}/api/chart?cmd=${cmd}&symbol=${info.symbol}&interval=${interval}&limit=60`;
    const chartRes = await fetch(url);
    if (!chartRes.ok) throw new Error(`chart API ${chartRes.status}`);

    const buf = await chartRes.arrayBuffer();
    const pct = chartRes.headers.get('X-Pct') ?? '0';
    const dir = parseFloat(pct) >= 0 ? '📈' : '📉';
    const isScreenshot = chartRes.headers.get('Content-Type')?.includes('jpeg');
    const caption = isScreenshot
      ? `${dir} *${info.label}* · ${interval}`
      : `${dir} *${info.label}* · ${interval}\n_${parseFloat(pct) >= 0 ? '+' : ''}${pct}% over window_`;

    await sendPhotoBuffer(token, chatId, buf, caption);
  } catch (err: any) {
    await sendMessage(token, chatId, `❌ Chart failed: \`${err.message}\`\n\nTry again in a moment.`);
  }
}

export function resolveTelegramUserName(from?: { first_name?: string; username?: string } | null): string {
  const first = typeof from?.first_name === 'string' ? from.first_name.trim() : '';
  if (first) return first;
  const user = typeof from?.username === 'string' ? from.username.trim().replace(/^@+/, '') : '';
  if (user) return user;
  return 'there';
}

export function buildStartMessage(firstName: string): string {
  return [
    `Hi! Welcome to ETFSignalAI, ${firstName}! 👋`,
    ``,
    `I'm *The Agent*, ETFSignalAI's market intelligence assistant. I analyze institutional ETF flows, market trends, and trading signals to help you make more informed decisions.`,
    ``,
    `*Agent Market Intelligence:*`,
    `• /signal or /btc — Live BTC ETF signal`,
    `• /eth — Live ETH ETF signal`,
    `• /status — ETF market snapshot`,
    ``,
    `*Charts:*`,
    `• /ch — BTC/USDT 1m chart`,
    `• /chb — BTC perp 1m chart`,
    `• /che — ETH perp 1m chart`,
    `• /tv btc|eth — 1h TradingView-style chart`,
    ``,
    `*Market Data:*`,
    `• /gas — Ethereum gas prices`,
    `• /subscribe — Auto signal alerts`,
    `• /link — Link your wallet for trade alerts`,
    ``,
    `📊 *Data:* SoSoValue + Binance + Etherscan`,
    `⚡ *Intelligence:* The Agent · AI Market Intelligence`,
    `⛓ *Exchange:* SoDEX · chain 286623`,
  ].join('\n');
}

async function handleStart(token: string, chatId: number, firstName: string) {
  await sendMessage(token, chatId, buildStartMessage(firstName));
}

async function handleHelp(token: string, chatId: number) {
  await sendMessage(token, chatId, [
    `⚡ *The Agent — ETFSignalAI Commands*`,
    ``,
    `*Agent Market Intelligence:*`,
    `*/signal* or */btc* — Live BTC signal (The Agent + ETF flows)`,
    `*/eth* — Live ETH signal`,
    `*/status* — Live BTC & ETH ETF market snapshot`,
    ``,
    `*Charts:*`,
    `*/ch* — BTC/USDT 1m candlestick`,
    `*/chb* — BTC perp 1m chart`,
    `*/che* — ETH perp 1m chart`,
    `*/tv* btc|eth — 1h chart (default BTC)`,
    ``,
    `*Market Data:*`,
    `*/gas* — Ethereum gas prices (with Refresh)`,
    `*/subscribe* — Get auto-alerts from the dashboard`,
    `*/unsubscribe* — Stop alerts`,
    `*/link* ETF\\-XXXXXX — Link wallet for personal trade alerts`,
    `*/unlink* — Disconnect your wallet`,
    ``,
    `[🌐 Web Dashboard](${DASHBOARD_URL})`,
  ].join('\n'));
}

async function handleStatus(token: string, chatId: number) {
  await sendTyping(token, chatId);

  const [btc, eth, btcTick, ethTick] = await Promise.all([
    fetchEtfSnapshot('us-btc-spot'),
    fetchEtfSnapshot('us-eth-spot'),
    fetchBinanceTicker('BTCUSDT'),
    fetchBinanceTicker('ETHUSDT'),
  ]);

  const now = new Date();
  const lines: string[] = [
    `📊 *ETF Market Snapshot*`,
    `_${now.toUTCString()}_`,
    ``,
  ];

  // BTC section
  if (btc) {
    lines.push(`*₿ Bitcoin ETF*`);
    if (btc.totalAum    != null) lines.push(`🏦 AUM: ${fmtAUM(btc.totalAum)}`);
    if (btc.dailyInflow != null) lines.push(`${btc.dailyInflow >= 0 ? '💚' : '🔴'} Today: ${fmtUSD(btc.dailyInflow)}`);
    if (btc.cumInflow   != null) lines.push(`📈 Cumulative: ${fmtAUM(btc.cumInflow)}`);
    if (btc.topFunds.length) {
      lines.push(``, `*Top Funds Today:*`);
      btc.topFunds.forEach(f => lines.push(`• ${f.ticker}: ${fmtUSD(f.inflow)}`));
    }
    if (btcTick?.price) {
      lines.push(
        ``,
        `*BTC Price:* $${btcTick.price.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${btcTick.changePct >= 0 ? '+' : ''}${btcTick.changePct.toFixed(2)}% 24h)`,
      );
    }
  } else {
    lines.push(
      `₿ *Bitcoin ETF*`,
      btcTick?.price
        ? `*BTC Price:* $${btcTick.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `_ETF data unavailable_`,
    );
  }

  lines.push(``);

  // ETH section
  if (eth) {
    lines.push(`*Ξ Ethereum ETF*`);
    if (eth.totalAum    != null) lines.push(`🏦 AUM: ${fmtAUM(eth.totalAum)}`);
    if (eth.dailyInflow != null) lines.push(`${eth.dailyInflow >= 0 ? '💚' : '🔴'} Today: ${fmtUSD(eth.dailyInflow)}`);
    if (ethTick?.price) {
      lines.push(`*ETH Price:* $${ethTick.price.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${ethTick.changePct >= 0 ? '+' : ''}${ethTick.changePct.toFixed(2)}% 24h)`);
    }
  } else {
    lines.push(
      `Ξ *Ethereum ETF*`,
      ethTick?.price
        ? `*ETH Price:* $${ethTick.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `_ETF data unavailable_`,
    );
  }

  lines.push(``, `_Use /signal for Agent market intelligence analysis_`);

  await sendMessage(token, chatId, lines.join('\n'));
}

async function handleSubscribe(token: string, chatId: number) {
  const kv = kvAvailable();

  if (kv) {
    const already = await subscriberExists(String(chatId));
    if (already) {
      await sendMessage(token, chatId, [
        `✅ *Already subscribed!*`,
        ``,
        `You are receiving automatic alerts whenever a new signal is generated from the ETFSignal AI dashboard.`,
        ``,
        `_Use /unsubscribe to stop alerts_`,
      ].join('\n'));
      return;
    }
    await subscriberAdd(String(chatId));
  }

  await sendMessage(token, chatId, [
    `✅ *Subscribed to ETFSignal Alerts!*`,
    ``,
    `You will receive automatic notifications when:`,
    `• A new high-confidence signal is generated`,
    `• A trade is executed on SoDEX from your wallet`,
    ``,
    `*Your Chat ID:* \`${chatId}\``,
    kv ? `` : `\n⚠️ _Persistence not configured — contact admin to enable auto-alerts._`,
    `_Use /unsubscribe to stop alerts_`,
  ].filter(Boolean).join('\n'));
}

export interface LinkVerificationResult {
  ok: boolean;
  status: 'linked' | 'invalid_format' | 'not_found' | 'expired';
  walletAddress?: string;
  message: string;
}

export async function verifyAndLinkWallet(
  rawCode: string,
  chatId: number | string,
): Promise<LinkVerificationResult> {
  const code = normalizeLinkCode(rawCode);
  if (!code) {
    return {
      ok: false,
      status: 'invalid_format',
      message: [
        `⚠️ *Invalid code format.*`,
        ``,
        `Usage: \`/link ETF-XXXXXX\``,
        ``,
        `Get your personal code from the dashboard:`,
        `[${DASHBOARD_URL}/app](${DASHBOARD_URL}/app) → Trade → Link Telegram`,
      ].join('\n'),
    };
  }

  const raw = await dualGet(codeKey(code));
  if (!raw) {
    return {
      ok: false,
      status: 'not_found',
      message: [
        `❌ *Code not found or expired.*`,
        ``,
        `Codes expire after 10 minutes and can only be used once. Please generate a new one from the dashboard.`,
        `[Get a new code →](${DASHBOARD_URL}/app)`,
      ].join('\n'),
    };
  }

  let data: { walletAddress: string; expiresAt: number };
  try {
    data = JSON.parse(raw);
  } catch {
    await dualDel(codeKey(code));
    return {
      ok: false,
      status: 'not_found',
      message: '❌ *Invalid code.* Please generate a new one from the dashboard.',
    };
  }

  if (Date.now() > data.expiresAt) {
    await dualDel(codeKey(code));
    return {
      ok: false,
      status: 'expired',
      message: [
        `❌ *Code expired.*`,
        ``,
        `Codes are valid for 10 minutes. Please generate a new one from the dashboard.`,
        `[Get a new code →](${DASHBOARD_URL}/app)`,
      ].join('\n'),
    };
  }

  const walletAddress = data.walletAddress.trim();
  const short = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  await Promise.all([
    dualSet(walletKey(walletAddress), String(chatId)),
    dualSet(chatKey(chatId), walletAddress.toLowerCase()),
    dualDel(codeKey(code)),
    dualDel(`etfsignal:link:pending:${walletAddress.toLowerCase()}`),
  ]);

  return {
    ok: true,
    status: 'linked',
    walletAddress,
    message: [
      `✅ *Wallet Linked!*`,
      ``,
      `Your wallet \`${short}\` is now connected to this Telegram account.`,
      ``,
      `You will now receive *personal alerts* when:`,
      `• A trade executes on SoDEX from your wallet`,
      ``,
      `_Use /unlink to disconnect your wallet_`,
      `[Open Dashboard →](${DASHBOARD_URL}/app)`,
    ].join('\n'),
  };
}

async function handleLink(token: string, chatId: number, rawCode: string) {
  const result = await verifyAndLinkWallet(rawCode, chatId);
  await sendMessage(token, chatId, result.message);
}

async function handleUnlink(token: string, chatId: number) {
  const walletAddress = await dualGet(chatKey(chatId));
  if (!walletAddress) {
    await sendMessage(token, chatId, '⚠️ *No wallet linked to this account.*\n\nUse /link to connect your wallet.');
    return;
  }
  await Promise.all([
    dualDel(walletKey(walletAddress)),
    dualDel(chatKey(chatId)),
  ]);
  const short = `${(walletAddress as string).slice(0, 6)}...${(walletAddress as string).slice(-4)}`;
  await sendMessage(token, chatId, `🔗 *Wallet \`${short}\` unlinked.*\n\nYou will no longer receive personal trade alerts.\n\nUse /link to reconnect anytime.`);
}

async function handleUnsubscribe(token: string, chatId: number) {
  if (kvAvailable()) {
    await subscriberRemove(String(chatId));
  }
  await sendMessage(
    token,
    chatId,
    `🔕 *Unsubscribed.* You will no longer receive automatic alerts.\n\nType /subscribe to re-enable anytime.`,
  );
}

// ─── Deduplication & Single-Message Progress for /signal, /btc, /eth ─────────

const INFLIGHT_TTL_SEC = 25;
const UPDATE_DEDUPE_TTL_SEC = 120;
const localInFlight = new Set<string>();
const localSeenUpdates = new Map<number, number>();

export function resetTelegramDedupeState(): void {
  localInFlight.clear();
  localSeenUpdates.clear();
}

async function isDuplicateWebhookUpdate(updateId?: number): Promise<boolean> {
  if (typeof updateId !== 'number') return false;
  const now = Date.now();
  const prev = localSeenUpdates.get(updateId);
  if (prev && now - prev < UPDATE_DEDUPE_TTL_SEC * 1000) {
    return true;
  }
  localSeenUpdates.set(updateId, now);

  const key = `etfsignal:tg:update:${updateId}`;
  const existing = await dualGet(key);
  if (existing) return true;
  await dualSet(key, '1', UPDATE_DEDUPE_TTL_SEC);
  return false;
}

export async function handleSignal(
  token:   string,
  chatId:  number,
  asset:   'BTC' | 'ETH',
  baseUrl: string,
): Promise<void> {
  const lockKey = `etfsignal:tg:inflight:${chatId}:${asset}`;
  if (localInFlight.has(lockKey)) {
    return;
  }
  // Acquire local lock synchronously before awaiting remote lock to prevent race conditions
  localInFlight.add(lockKey);

  try {
    const remoteLock = await dualGet(lockKey);
    if (remoteLock) {
      return;
    }
    await dualSet(lockKey, String(Date.now()), INFLIGHT_TTL_SEC);

    await sendTyping(token, chatId);

    // 1. Send ONE initial progress message and store its message_id
    let lastProgressText = `⚙️ *The Agent is analyzing ${asset} ETF flows...*`;
    const progressMsgId = await sendMessage(token, chatId, lastProgressText);

    const updateProgress = async (nextText: string) => {
      if (!progressMsgId || nextText === lastProgressText) return;
      lastProgressText = nextText;
      await editMessage(token, chatId, progressMsgId, nextText);
    };

    try {
      const signalText = await generateSignal(asset, baseUrl, updateProgress);

      // Replace the progress message in-place with the final signal
      if (progressMsgId) {
        const edited = await editMessage(token, chatId, progressMsgId, signalText);
        if (!edited) {
          await sendMessage(token, chatId, signalText);
        }
      } else {
        await sendMessage(token, chatId, signalText);
      }
    } catch (err: any) {
      const safeMsg = String(err?.message ?? 'Analysis unavailable').replace(/`/g, "'");
      const errorText = `❌ *${asset} Signal Analysis Failed*\n\`${safeMsg}\`\n\nPlease try again in a moment.`;
      if (progressMsgId) {
        const edited = await editMessage(token, chatId, progressMsgId, errorText);
        if (!edited) {
          await sendMessage(token, chatId, errorText);
        }
      } else {
        await sendMessage(token, chatId, errorText);
      }
    }
  } finally {
    localInFlight.delete(lockKey);
    await dualDel(lockKey);
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const reqUrl = new URL(req.url);
  const route = reqUrl.searchParams.get('_route');

  // Shared-isolate routing for /api/telegram-link and /api/telegram-notify
  if (route === 'link' || reqUrl.pathname.endsWith('/telegram-link')) {
    return handleTelegramLinkRequest(req);
  }
  if (route === 'notify' || reqUrl.pathname.endsWith('/telegram-notify')) {
    return handleTelegramNotifyRequest(req);
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const botToken    = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new Response(
      JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Derive base URL from the incoming request so this works in any environment
  // (production, preview, local). Used to call /api/analyze — same proxy the dashboard uses.
  const baseUrl = reqUrl.origin;

  let update: any;
  try { update = await req.json(); }
  catch { return new Response('Bad request', { status: 400 }); }

  // Deduplicate repeated Telegram webhook deliveries for the same update_id
  if (await isDuplicateWebhookUpdate(update?.update_id)) {
    return new Response('OK', { status: 200 });
  }

  // ── Handle inline keyboard callbacks (e.g. gas Refresh button) ─────────────
  const cbQuery = update?.callback_query;
  if (cbQuery) {
    const cbChatId = cbQuery.message?.chat?.id;
    const cbMsgId  = cbQuery.message?.message_id;
    const cbData   = cbQuery.data ?? '';

    try {
      if (cbData === 'gas_refresh') {
        await answerCallback(botToken, cbQuery.id, 'Refreshing gas prices...');
        const gas = await fetchGasPrice();
        if (gas && cbChatId && cbMsgId) {
          await editMessage(botToken, cbChatId, cbMsgId, formatGasMessage(gas), GAS_REFRESH_KEYBOARD);
        } else {
          await answerCallback(botToken, cbQuery.id, '❌ Gas API unavailable');
        }
      }
    } catch (err: any) {
      console.error('[telegram] callback error:', err);
    }
    return new Response('OK', { status: 200 });
  }

  const message = update?.message;
  if (!message) return new Response('OK', { status: 200 }); // ignore non-message updates

  const chatId:    number = message.chat?.id;
  const text:      string = (message.text ?? '').trim();
  const firstName: string = resolveTelegramUserName(message.from);

  // Parse command and optional argument (e.g. "/tv btc" → command="/tv", arg="btc")
  const parts:   string[] = text.split(/\s+/);
  const command: string   = (parts[0] ?? '').split('@')[0].toLowerCase();
  const arg:     string   = (parts[1] ?? '').toLowerCase();
  const rawRest: string   = parts.slice(1).join(' ').trim();

  try {
    switch (command) {
      case '/start':
        await handleStart(botToken, chatId, firstName);
        break;

      case '/help':
        await handleHelp(botToken, chatId);
        break;

      case '/status':
        await handleStatus(botToken, chatId);
        break;

      case '/subscribe':
        await handleSubscribe(botToken, chatId);
        break;

      case '/unsubscribe':
        await handleUnsubscribe(botToken, chatId);
        break;

      case '/link':
        await handleLink(botToken, chatId, rawRest);
        break;

      case '/unlink':
        await handleUnlink(botToken, chatId);
        break;

      case '/signal':
      case '/btc':
        await handleSignal(botToken, chatId, 'BTC', baseUrl);
        break;

      case '/eth':
        await handleSignal(botToken, chatId, 'ETH', baseUrl);
        break;

      // ── Gas prices ─────────────────────────────────────────────────────
      case '/gas':
        await handleGas(botToken, chatId);
        break;

      // ── Charts ─────────────────────────────────────────────────────────
      case '/ch':
        await handleChart(botToken, chatId, 'ch',  'btc',  '1m', baseUrl);
        break;

      case '/chb':
        await handleChart(botToken, chatId, 'chb', 'btcp', '1m', baseUrl);
        break;

      case '/che':
        await handleChart(botToken, chatId, 'che', 'ethp', '1m', baseUrl);
        break;

      case '/tv': {
        const tvAsset = arg === 'eth' ? 'eth' : 'btc';
        await handleChart(botToken, chatId, `tv_${tvAsset}`, tvAsset, '1h', baseUrl);
        break;
      }

      default:
        // If user pastes bare "ETF-XXXXXX" directly in chat, treat it as /link ETF-XXXXXX
        if (normalizeLinkCode(text)) {
          await handleLink(botToken, chatId, text);
        } else if (text.startsWith('/')) {
          await sendMessage(
            botToken,
            chatId,
            `Unknown command: \`${command}\`\n\nType /help to see available commands.`,
          );
        }
        // Ignore other plain text messages silently
    }
  } catch (err: any) {
    console.error('[telegram] handler error:', err);
  }

  // Always return 200 — Telegram will retry on any other status
  return new Response('OK', { status: 200 });
}
