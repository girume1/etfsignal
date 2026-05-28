#!/usr/bin/env node
// Run ONCE after deploying to Vercel to register the Telegram webhook.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=your_token node scripts/setup-telegram-webhook.js
//
// Or if deploying to a custom domain:
//   WEBHOOK_HOST=https://your-custom-domain.com TELEGRAM_BOT_TOKEN=your_token node scripts/setup-telegram-webhook.js

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST ?? 'https://etfsignal.vercel.app';
const WEBHOOK_URL  = `${WEBHOOK_HOST}/api/telegram`;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN env var is not set.');
  console.error('   Run: TELEGRAM_BOT_TOKEN=your_token node scripts/setup-telegram-webhook.js');
  process.exit(1);
}

async function main() {
  const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

  // 1. Register webhook
  console.log(`\n🤖 Setting Telegram webhook → ${WEBHOOK_URL}`);
  const setRes  = await fetch(`${TG}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:                  WEBHOOK_URL,
      allowed_updates:      ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  });
  const setData = await setRes.json();
  if (setData.ok) {
    console.log('✅ Webhook registered successfully!');
  } else {
    console.error('❌ Failed to register webhook:', setData.description);
    process.exit(1);
  }

  // 2. Verify webhook info
  const infoRes  = await fetch(`${TG}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log('\n📡 Webhook info:');
  console.log(`   URL:         ${infoData.result?.url}`);
  console.log(`   Pending:     ${infoData.result?.pending_update_count ?? 0}`);
  console.log(`   Last error:  ${infoData.result?.last_error_message ?? 'none'}`);

  // 3. Register bot commands menu (shown in Telegram client)
  console.log('\n📋 Registering bot command menu...');
  const cmdRes  = await fetch(`${TG}/setMyCommands`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'signal',      description: 'Live BTC ETF signal (Claude AI)' },
        { command: 'btc',         description: 'BTC-specific AI signal' },
        { command: 'eth',         description: 'ETH-specific AI signal' },
        { command: 'status',      description: 'Live BTC & ETH ETF market snapshot' },
        { command: 'ch',          description: 'BTC/USDT 1m candlestick chart' },
        { command: 'chb',         description: 'BTC perp 1m chart' },
        { command: 'che',         description: 'ETH perp 1m chart' },
        { command: 'tv',          description: '/tv btc or /tv eth — 1h chart' },
        { command: 'gas',         description: 'Ethereum gas prices' },
        { command: 'subscribe',   description: 'Subscribe to automatic signal alerts' },
        { command: 'unsubscribe', description: 'Stop receiving automatic alerts' },
        { command: 'help',        description: 'Show all commands' },
      ],
    }),
  });
  const cmdData = await cmdRes.json();
  if (cmdData.ok) {
    console.log('✅ Bot command menu registered!');
  } else {
    console.warn('⚠️  Failed to register commands:', cmdData.description);
  }

  // 4. Print a summary of required env vars
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Telegram bot setup complete!

Required Vercel env vars:
  TELEGRAM_BOT_TOKEN        ✓ (already set)
  ANTHROPIC_API_KEY         — needed for /signal, /btc, /eth
  SOSOVALUE_API_KEY         — needed for live ETF data

Optional (for subscriber persistence):
  UPSTASH_REDIS_REST_URL    — Upstash Redis endpoint
  UPSTASH_REDIS_REST_TOKEN  — Upstash Redis bearer token

Optional (for fallback static subscribers):
  TELEGRAM_SUBSCRIBER_IDS   — comma-separated chat IDs

How to get Upstash (free tier):
  1. https://upstash.com → create account → New Database
  2. Copy REST URL and REST Token to Vercel env vars
  3. /subscribe will then persist subscriber IDs automatically
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open t.me/ETFSignalAIBot and type /start to test.
`);
}

main().catch(console.error);
