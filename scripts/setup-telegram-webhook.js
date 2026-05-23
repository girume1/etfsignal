#!/usr/bin/env node
// Run this ONCE after deploying to Vercel to register the webhook with Telegram.
// Usage: node scripts/setup-telegram-webhook.js
//
// Requires: TELEGRAM_BOT_TOKEN env var (or edit BOT_TOKEN below)
// Webhook will point to: https://etfsignal.vercel.app/api/telegram

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN env var is not set.');
  console.error('   Run: TELEGRAM_BOT_TOKEN=your_token node scripts/setup-telegram-webhook.js');
  process.exit(1);
}
const WEBHOOK_URL = 'https://etfsignal.vercel.app/api/telegram';

async function main() {
  // 1. Set webhook
  console.log(`\n🤖 Setting Telegram webhook → ${WEBHOOK_URL}`);
  const setRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    }
  );
  const setData = await setRes.json();
  if (setData.ok) {
    console.log('✅ Webhook registered successfully!');
  } else {
    console.error('❌ Failed:', setData.description);
    process.exit(1);
  }

  // 2. Get webhook info to confirm
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log('\n📡 Webhook info:');
  console.log(`   URL: ${info.result?.url}`);
  console.log(`   Pending: ${info.result?.pending_update_count ?? 0}`);
  console.log(`   Last error: ${info.result?.last_error_message ?? 'none'}`);

  // 3. Register bot commands menu
  const cmdRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'signal',      description: 'Generate a live ETF trading signal' },
          { command: 'status',      description: 'BTC ETF market snapshot' },
          { command: 'subscribe',   description: 'Subscribe to automatic signal alerts' },
          { command: 'unsubscribe', description: 'Stop receiving alerts' },
          { command: 'help',        description: 'Show all commands' },
        ],
      }),
    }
  );
  const cmdData = await cmdRes.json();
  if (cmdData.ok) {
    console.log('\n✅ Bot commands menu registered!');
  }

  console.log('\n🚀 Done! Open t.me/ETFSignalAIBot and type /start to test.\n');
}

main().catch(console.error);
