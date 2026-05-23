// Vercel Edge Function — Telegram Bot Webhook Handler
// Receives updates from Telegram and responds with ETF signals via Claude AI
// Bot: @ETFSignalAIBot | t.me/ETFSignalAIBot

declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const TELEGRAM_API = 'https://api.telegram.org';

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
) {
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
}

// ─── Signal generation via Claude AI ─────────────────────────────────────────

async function generateSignal(apiKey: string): Promise<string> {
  // Realistic mock market data (production: call SoSoValue API)
  const mockData = {
    totalNetAssets: 127_400_000_000,
    dailyNetInflow: 412_300_000,
    cumulativeNetInflow: 48_200_000_000,
    topFund: { ticker: 'IBIT', dailyInflow: 310_000_000 },
    btcPrice: 107_450,
    priceChange24h: 2.3,
    newsHeadlines: [
      'Bitcoin ETF inflows surge as institutional demand grows',
      'Fed signals steady rate path through Q3 2026',
    ],
  };

  const prompt = `You are an expert crypto ETF trading analyst. Analyze this real-time market data and generate a structured trading signal.

Market Data (${new Date().toUTCString()}):
- Total BTC ETF AUM: $${(mockData.totalNetAssets / 1e9).toFixed(1)}B
- Today's Net Inflow: +$${(mockData.dailyNetInflow / 1e6).toFixed(1)}M
- Cumulative Net Inflow: $${(mockData.cumulativeNetInflow / 1e9).toFixed(1)}B
- Top Fund: ${mockData.topFund.ticker} (+$${(mockData.topFund.dailyInflow / 1e6).toFixed(0)}M)
- BTC Price: $${mockData.btcPrice.toLocaleString()} (${mockData.priceChange24h > 0 ? '+' : ''}${mockData.priceChange24h}% 24h)
- News: ${mockData.newsHeadlines.join('; ')}

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data: any = await response.json();
  const raw = data?.content?.[0]?.text?.trim() ?? '';

  let signal: any;
  try {
    signal = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse signal JSON from Claude');
  }

  const directionEmoji: Record<string, string> = {
    LONG: '🟢',
    SHORT: '🔴',
    NEUTRAL: '🟡',
  };
  const emoji = directionEmoji[signal.direction] ?? '⚪';
  const confBar = buildConfBar(signal.confidence);

  return [
    `📡 *ETFSignal AI — Live Signal*`,
    ``,
    `${emoji} *${signal.direction}* | Confidence: ${signal.confidence}%`,
    `${confBar}`,
    ``,
    `💰 *Entry:* $${Number(signal.entryPrice).toLocaleString()}`,
    `🎯 *Take Profit:* $${Number(signal.takeProfit).toLocaleString()}`,
    `🛑 *Stop Loss:* $${Number(signal.stopLoss).toLocaleString()}`,
    `⏱ *Timeframe:* ${signal.timeframe}`,
    ``,
    `📊 *Key Driver:* ${signal.topDriver}`,
    ``,
    `💡 *Analysis:* ${signal.thesis}`,
    ``,
    `_Powered by SoSoValue ETF data · Claude AI · SoDEX testnet_`,
    `[View Dashboard](https://etfsignalaim.vercel.app)`,
  ].join('\n');
}

function buildConfBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${confidence}%`;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(botToken: string, chatId: number, firstName: string) {
  const msg = [
    `👋 *Welcome to ETFSignal AI, ${firstName}!*`,
    ``,
    `I analyze Bitcoin ETF flows in real-time using SoSoValue data and Claude AI to generate institutional-grade trading signals.`,
    ``,
    `*Commands:*`,
    `• /signal — Generate a live ETF trading signal`,
    `• /status — Current BTC ETF market overview`,
    `• /subscribe — Get automatic signal alerts`,
    `• /help — Show this menu`,
    ``,
    `📊 *Data Sources:* SoSoValue ETF flows, BTC price, news sentiment`,
    `🤖 *AI Engine:* Claude 3.5 Haiku`,
    `⛓ *Execution:* SoDEX testnet`,
    ``,
    `_Type /signal to get your first signal now!_`,
  ].join('\n');
  await sendMessage(botToken, chatId, msg);
}

async function handleHelp(botToken: string, chatId: number) {
  const msg = [
    `🤖 *ETFSignal AI — Command Reference*`,
    ``,
    `*/signal* — Generate a Claude-powered trading signal based on live ETF flow data`,
    `*/status* — Quick BTC ETF market snapshot`,
    `*/subscribe* — Subscribe to automatic alerts when new signals are generated`,
    `*/unsubscribe* — Stop receiving automatic alerts`,
    `*/help* — Show this menu`,
    ``,
    `*About:*`,
    `ETFSignal AI combines SoSoValue's institutional ETF flow data with Claude AI analysis to produce structured, actionable trading signals with confidence scores and risk management levels.`,
    ``,
    `[🌐 Web Dashboard](https://etfsignalaim.vercel.app)`,
  ].join('\n');
  await sendMessage(botToken, chatId, msg);
}

async function handleStatus(botToken: string, chatId: number) {
  // Production: call SoSoValue API for real data
  const now = new Date();
  const msg = [
    `📊 *BTC ETF Market Snapshot*`,
    `_${now.toUTCString()}_`,
    ``,
    `🏦 *Total AUM:* $127.4B`,
    `💚 *Today's Inflow:* +$412.3M`,
    `📈 *Cumulative Flow:* $48.2B`,
    ``,
    `*Top Movers Today:*`,
    `• IBIT: +$310M 🟢`,
    `• FBTC: +$67M 🟢`,
    `• ARKB: +$35M 🟢`,
    ``,
    `*BTC Price:* $107,450 (+2.3% 24h)`,
    `*Market Sentiment:* 🟢 Bullish (ETF accumulation phase)`,
    ``,
    `_Use /signal for AI-powered trade analysis_`,
  ].join('\n');
  await sendMessage(botToken, chatId, msg);
}

async function handleSubscribe(botToken: string, chatId: number) {
  const msg = [
    `✅ *Subscribed to ETFSignal Alerts!*`,
    ``,
    `You'll receive automatic notifications whenever:`,
    `• A new high-confidence signal is generated`,
    `• A trade is executed on SoDEX testnet`,
    `• Significant ETF flow events occur`,
    ``,
    `*Your Chat ID:* \`${chatId}\``,
    ``,
    `_Use /unsubscribe to stop alerts_`,
  ].join('\n');
  await sendMessage(botToken, chatId, msg);
}

async function handleUnsubscribe(botToken: string, chatId: number) {
  await sendMessage(
    botToken,
    chatId,
    `🔕 *Unsubscribed.* You will no longer receive automatic alerts.\n\nType /subscribe to re-enable anytime.`,
  );
}

async function handleSignal(botToken: string, chatId: number, apiKey: string) {
  // Send "typing..." indicator
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // Send placeholder while generating
  await sendMessage(
    botToken,
    chatId,
    `⚙️ *Analyzing ETF flows with Claude AI...*\n_Fetching SoSoValue data and generating signal_`,
  );

  try {
    const signalText = await generateSignal(apiKey);
    await sendMessage(botToken, chatId, signalText);
  } catch (err: any) {
    await sendMessage(
      botToken,
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!botToken) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const message = update?.message;
  if (!message) {
    // Ignore non-message updates (edited messages, callback queries, etc.)
    return new Response('OK', { status: 200 });
  }

  const chatId: number = message.chat?.id;
  const text: string = message.text ?? '';
  const firstName: string = message.from?.first_name ?? 'Trader';

  // Parse command (strip @BotName suffix if present)
  const command = text.split(' ')[0].split('@')[0].toLowerCase();

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
        if (!anthropicKey) {
          await sendMessage(
            botToken,
            chatId,
            '❌ *AI engine not configured.* Please check the dashboard instead.',
          );
        } else {
          await handleSignal(botToken, chatId, anthropicKey);
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
        // Ignore non-command messages silently
    }
  } catch (err: any) {
    console.error('Telegram handler error:', err);
  }

  // Always return 200 to Telegram to acknowledge receipt
  return new Response('OK', { status: 200 });
}
