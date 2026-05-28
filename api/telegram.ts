// Vercel Edge Function — Telegram Bot Webhook Handler
// Bot: @ETFSignalAIBot | t.me/ETFSignalAIBot
//
// Env vars required:
//   TELEGRAM_BOT_TOKEN        — Telegram bot HTTP API token
//   ANTHROPIC_API_KEY         — Claude AI key (for /signal)
//   SOSOVALUE_API_KEY         — SoSoValue ETF data key (for /status & /signal)
//   UPSTASH_REDIS_REST_URL    — Upstash Redis endpoint (for subscriber persistence)
//   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis bearer token

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const TELEGRAM_API     = 'https://api.telegram.org';
const SOSO_PRIMARY     = 'https://openapi.sosovalue.com';
const SOSO_FALLBACK    = 'https://api.sosovalue.xyz';
const SUBSCRIBERS_KEY  = 'telegram:subscribers';
const DASHBOARD_URL    = 'https://etfsignal.vercel.app';

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:                  chatId,
      text,
      parse_mode:               parseMode,
      disable_web_page_preview: true,
    }),
  });
}

async function sendTyping(token: string, chatId: number | string) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
}

// ─── Upstash Redis (HTTP-only — no npm package required) ─────────────────────
// Uses the Upstash REST command format: POST body is ["CMD", "key", "arg", ...]

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

const kvAvailable = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

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
  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) return null;

  for (const base of [SOSO_PRIMARY, SOSO_FALLBACK]) {
    try {
      const res = await fetch(`${base}/openapi/v2/etf/currentEtfDataMetrics`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-soso-api-key': apiKey },
        body:    JSON.stringify({ type }),
      });
      if (!res.ok) continue;

      const json: any = await res.json();
      if (json.code !== 0 || !json.data) continue;

      const d = json.data;
      const topFunds: Array<{ ticker: string; inflow: number }> = (d.list ?? [])
        .filter((f: any) => (f.dailyNetInflow?.value ?? 0) > 0)
        .sort((a: any, b: any) => (b.dailyNetInflow?.value ?? 0) - (a.dailyNetInflow?.value ?? 0))
        .slice(0, 3)
        .map((f: any) => ({ ticker: f.ticker, inflow: f.dailyNetInflow?.value ?? 0 }));

      return {
        totalAum:    d.totalNetAssets?.value  ?? null,
        dailyInflow: d.dailyNetInflow?.value  ?? null,
        cumInflow:   d.cumNetInflow?.value    ?? null,
        topFunds,
      };
    } catch { /* try next host */ }
  }
  return null;
}

// Fetch 24-hr ticker from Binance (price + percent change)
async function fetchBinanceTicker(symbol: 'BTCUSDT' | 'ETHUSDT'): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
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

// ─── Signal generation (Claude AI + live SoSoValue data) ──────────────────────

async function generateSignal(anthropicKey: string, asset: 'BTC' | 'ETH'): Promise<string> {
  const etfType = asset === 'BTC' ? 'us-btc-spot' : 'us-eth-spot';
  const binSym  = asset === 'BTC' ? 'BTCUSDT'     : 'ETHUSDT';

  // Fetch data in parallel
  const [snap, ticker] = await Promise.all([
    fetchEtfSnapshot(etfType),
    fetchBinanceTicker(binSym),
  ]);

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

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) throw new Error(`Claude API error: ${aiRes.status}`);

  const aiData: any  = await aiRes.json();
  const raw: string  = aiData?.content?.[0]?.text?.trim() ?? '';

  let sig: any;
  try { sig = JSON.parse(raw); }
  catch { throw new Error('Failed to parse signal JSON from Claude'); }

  const dirEmoji: Record<string, string> = { LONG: '🟢', SHORT: '🔴', NEUTRAL: '🟡' };
  const emoji = dirEmoji[sig.direction] ?? '⚪';

  return [
    `📡 *ETFSignal AI — ${asset} Signal*`,
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
    `💡 *Analysis:* ${sig.thesis}`,
    ``,
    snap ? `_SoSoValue ETF flows · Claude AI · SoDEX testnet_` : `_Claude AI · SoDEX testnet_`,
    `[View Dashboard](${DASHBOARD_URL})`,
  ].join('\n');
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(token: string, chatId: number, firstName: string) {
  await sendMessage(token, chatId, [
    `👋 *Welcome to ETFSignal AI, ${firstName}!*`,
    ``,
    `I analyze Bitcoin & Ethereum ETF flows in real-time using SoSoValue institutional data and Claude AI to generate actionable trading signals.`,
    ``,
    `*Commands:*`,
    `• /signal — Live BTC trading signal`,
    `• /btc — BTC-specific signal`,
    `• /eth — ETH-specific signal`,
    `• /status — Live ETF market overview`,
    `• /subscribe — Subscribe to automatic alerts`,
    `• /unsubscribe — Stop alerts`,
    `• /help — Show all commands`,
    ``,
    `📊 *Data:* SoSoValue ETF flows (real-time)`,
    `🤖 *AI:* Claude 3.5 Haiku`,
    `⛓ *Exchange:* SoDEX testnet · chain 138565`,
    ``,
    `_Type /signal to get your first signal now!_`,
  ].join('\n'));
}

async function handleHelp(token: string, chatId: number) {
  await sendMessage(token, chatId, [
    `🤖 *ETFSignal AI — Commands*`,
    ``,
    `*/signal* or */btc* — Claude-powered BTC signal using live ETF flows`,
    `*/eth* — ETH-specific signal`,
    `*/status* — Live BTC & ETH ETF market snapshot`,
    `*/subscribe* — Auto-receive alerts from the dashboard`,
    `*/unsubscribe* — Stop receiving alerts`,
    `*/help* — Show this menu`,
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

  lines.push(``, `_Use /signal for AI-powered trade analysis_`);

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
    `• A trade is executed on SoDEX testnet`,
    ``,
    `*Your Chat ID:* \`${chatId}\``,
    kv ? `` : `\n⚠️ _Persistence not configured — contact admin to enable auto-alerts._`,
    `_Use /unsubscribe to stop alerts_`,
  ].filter(Boolean).join('\n'));
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

async function handleSignal(
  token:        string,
  chatId:       number,
  anthropicKey: string,
  asset:        'BTC' | 'ETH',
) {
  await sendTyping(token, chatId);
  await sendMessage(
    token,
    chatId,
    `⚙️ *Analyzing ${asset} ETF flows with Claude AI...*\n_Fetching live SoSoValue data — this takes a few seconds_`,
  );

  try {
    const signalText = await generateSignal(anthropicKey, asset);
    await sendMessage(token, chatId, signalText);
  } catch (err: any) {
    await sendMessage(
      token,
      chatId,
      `❌ *Signal generation failed*\n\`${err.message}\`\n\nPlease try again in a moment.`,
    );
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const botToken    = process.env.TELEGRAM_BOT_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!botToken) {
    return new Response(
      JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let update: any;
  try { update = await req.json(); }
  catch { return new Response('Bad request', { status: 400 }); }

  const message = update?.message;
  if (!message) return new Response('OK', { status: 200 }); // ignore non-message updates

  const chatId:    number = message.chat?.id;
  const text:      string = message.text ?? '';
  const firstName: string = message.from?.first_name ?? 'Trader';
  const command:   string = text.split(' ')[0].split('@')[0].toLowerCase();

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

      case '/signal':
      case '/btc':
        if (!anthropicKey) {
          await sendMessage(botToken, chatId, '❌ *AI engine not configured.* Please check the dashboard instead.');
        } else {
          await handleSignal(botToken, chatId, anthropicKey, 'BTC');
        }
        break;

      case '/eth':
        if (!anthropicKey) {
          await sendMessage(botToken, chatId, '❌ *AI engine not configured.* Please check the dashboard instead.');
        } else {
          await handleSignal(botToken, chatId, anthropicKey, 'ETH');
        }
        break;

      default:
        if (text.startsWith('/')) {
          await sendMessage(
            botToken,
            chatId,
            `Unknown command: \`${command}\`\n\nType /help to see available commands.`,
          );
        }
        // Ignore plain text messages silently
    }
  } catch (err: any) {
    console.error('[telegram] handler error:', err);
  }

  // Always return 200 — Telegram will retry on any other status
  return new Response('OK', { status: 200 });
}
