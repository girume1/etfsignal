<div align="center">

<pre align="center">
 _____ _______ ______  _____ _____ _____ _   _          _      
|  ___|__   __|  ____|/ ____|_   _/ ____| \ | |   /\   | |     
| |__    | |  | |__  | (___   | || |  __|  \| |  /  \  | |     
|  __|   | |  |  __|  \___ \  | || | |_ | . ` | / /\ \ | |     
| |____  | |  | |     ____) |_| || |__| | |\  |/ ____ \| |____ 
|______| |_|  |_|    |_____/|_____\_____|_| \_/_/    \_\______|

                         AI ⚡
</pre>

**AI-Powered BTC/ETH ETF Intelligence & Signal-to-Execution Platform**

*From institutional data → AI signal → on-chain trade. In one dashboard.*

<br/>

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-etfsignal.vercel.app-0057FF?style=for-the-badge)](https://etfsignal.vercel.app)
[![Telegram Bot](https://img.shields.io/badge/🤖%20Telegram-ETFSignalAIBot-26A5E4?style=for-the-badge)](https://t.me/ETFSignalAIBot)
[![Testnet](https://img.shields.io/badge/⛓%20SoDEX-Testnet-00C2FF?style=for-the-badge)](https://sodex.com)
[![Buildathon](https://img.shields.io/badge/🏆%20SoSoValue-Buildathon%202026-purple?style=for-the-badge)](https://sosovalue.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> **⚠️ Testnet Only** · Not financial advice · Built for SoSoValue Buildathon 2026

</div>

---

## ⚡ What is ETFSignal AI?

Most crypto traders are drowning in noise. BTC/ETH spot ETF flows, institutional inflows, on-chain events, and market news fire constantly — but no single tool **connects it all**, **explains what it means**, and **lets you act on it**.

**ETFSignal AI** closes that gap.

It pulls institutional ETF flow data from SoSoValue, streams live BTC/ETH prices from Binance, computes a live sentiment score, synthesizes everything with Claude AI into a structured signal with TP/SL levels and factor weights — then lets you execute directly on SoDEX testnet and receive a personal Telegram alert when your trade executes.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   SoSoValue API          Claude AI           SoDEX Testnet         │
│   ─────────────    →    ───────────    →    ─────────────────────  │
│   ETF Flows             Synthesize           Place Order           │
│   News Feed             Signal + TP/SL       EIP-712 Sign          │
│   Fund Data             Factor Weights        Confirm Trade         │
│                                                                     │
│   Binance WS            Upstash Redis        Telegram Bot          │
│   ──────────            ─────────────        ─────────────         │
│   Live BTC/ETH          Signal Archive        @ETFSignalAIBot      │
│   price (1s)            Subscribers           Personal Alerts       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 The Full Pipeline

| Step | What Happens |
|------|-------------|
| **1. Ingest** | Fetches live BTC & ETH spot ETF metrics — daily inflows, net assets, cumulative flows, per-fund breakdown |
| **2. Live Price** | Streams real-time BTC/ETH price from Binance WebSocket (~1s cadence); auto-reconnects |
| **3. Sentiment** | Computes a 0–100 flow sentiment score from 14-day momentum + inflow breadth |
| **4. Enrich** | Pulls categorised news: on-chain events, institutional reports, price alerts, research |
| **5. Analyze** | Claude AI synthesises everything into a structured signal: direction, confidence, key factors, TP/SL, risk warning, factor weights |
| **6. Signal** | Dashboard shows BULLISH / BEARISH / NEUTRAL with factor breakdown bars, headline, summary, trade idea, AskAI follow-up chat |
| **7. Execute** | User connects wallet, reviews order, acknowledges risk, signs via EIP-712, submits to SoDEX testnet |
| **8. Alert** | Telegram bot sends personal trade confirmation with Order ID to linked wallet |
| **9. Archive** | Signal stored in Upstash Redis with entry price; evaluated after 24h using real price delta |

---

## 🖥️ App Pages

The app is split into 5 focused views + a Trade page, all sharing one live data context (no re-fetch on navigation).

> **🔒 Wallet-gated** — all `/app/*` pages require a connected wallet. Unauthenticated visitors see a lock screen with a one-click connect prompt.

| Route | Purpose |
|-------|---------|
| `/app` | **Overview** — full cockpit: ETF panels, price/flow chart, donut, sentiment gauge, signal, alerts, news |
| `/app/flows` | **Flows** — BTC + ETH inflow charts and market-share donuts side-by-side |
| `/app/signals` | **Signals** — sentiment gauge, AI signal with factor weights, AskAI chat, signal archive with performance tracking |
| `/app/alerts` | **Alerts** — filterable grid of smart flow & anomaly alerts (by type + severity) |
| `/app/news` | **News** — searchable news grid with category filter |
| `/app/trade` | **Trade** — SoDEX spot orders, balance, faucet link, Telegram wallet link, execution history |

---

## 🤖 Telegram Bot — @ETFSignalAIBot

A full-featured companion bot at [@ETFSignalAIBot](https://t.me/ETFSignalAIBot):

| Command | Description |
|---------|------------|
| `/signal` or `/btc` | Live BTC AI signal (Claude + SoSoValue data) |
| `/eth` | Live ETH AI signal |
| `/status` | BTC & ETH ETF market snapshot |
| `/ch` | BTC/USDT 1m candlestick chart |
| `/chb` | BTC perp 1m chart |
| `/che` | ETH perp 1m chart |
| `/tv btc\|eth` | 1h TradingView-style chart |
| `/gas` | Ethereum gas prices with live Refresh button |
| `/subscribe` | Auto signal alerts from the dashboard |
| `/link ETF-XXXXXX` | Link wallet → receive personal trade alerts |
| `/unlink` | Disconnect wallet from Telegram |

**Wallet linking flow:** Dashboard → Trade → Generate Code → `/link ETF-XXXXXX` in bot → personal trade alerts on every SoDEX execution.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Any EVM wallet (MetaMask or Rabby)
- SoSoValue API key ([apply here](https://sosovalue.com/developer/dashboard))
- Anthropic API key ([get here](https://console.anthropic.com))

### 1. Clone & Install

```bash
git clone https://github.com/girume1/etfsignal.git
cd etfsignal/app
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
```

```env
# SERVER-SIDE — consumed by Vercel Edge Functions only, never sent to browser
ANTHROPIC_API_KEY=sk-ant-...
SOSOVALUE_API_KEY=SOSO-...
TELEGRAM_BOT_TOKEN=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CHARTIMG_API_KEY=...          # chart-img.com (free tier: 50/day)

# CLIENT-SIDE (VITE_ prefix = bundled into browser)
VITE_DYNAMIC_ENVIRONMENT_ID=your_dynamic_environment_id_here
```

> **Security note:** All API keys have **no** `VITE_` prefix — they are server-only variables consumed by Vercel Edge Functions. They are never bundled into the browser build.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🔑 Environment Variables

| Key | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | ✅ | Claude AI signal generation |
| `SOSOVALUE_API_KEY` | ✅ | Live ETF flow data |
| `VITE_DYNAMIC_ENVIRONMENT_ID` | ✅ | Wallet connection (Dynamic) |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram bot |
| `UPSTASH_REDIS_REST_URL` | ✅ | Signal archive + subscriber persistence |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis auth |
| `CHARTIMG_API_KEY` | Optional | TradingView-style chart images in bot |

---

## 🏗️ Architecture

```
etfsignal/
├── api/                          # Vercel serverless / Edge Functions
│   ├── analyze.ts                # Claude proxy (ANTHROPIC_API_KEY server-side)
│   ├── sosovalue.ts              # SoSoValue data proxy
│   ├── chart.ts                  # Chart image generator (chart-img.com + QuickChart fallback)
│   ├── signal-archive.ts         # Signal archive — GET/POST/PATCH via Upstash Redis
│   ├── telegram.ts               # Telegram bot webhook handler
│   ├── telegram-notify.ts        # Signal + trade broadcast to subscribers
│   ├── telegram-link.ts          # Wallet↔Telegram link code generator
│   └── sodex-balance.ts          # SoDEX balance proxy (avoids CORS)
│
├── scripts/
│   └── setup-telegram-webhook.js # One-time webhook registration script
│
└── app/
    └── src/
        ├── contexts/
        │   ├── DashboardContext.tsx  # Shared data + wallet + signal + trade state
        │   └── DensityContext.tsx    # Layout density (compact / comfortable / mobile)
        │
        ├── hooks/
        │   └── useLivePrices.ts      # Binance WebSocket — live BTC/ETH price stream
        │
        ├── services/
        │   ├── sosovalue.ts          # SoSoValue API client + fetchSignalHistory
        │   ├── ai.ts                 # Claude signal synthesis + AskAI follow-up
        │   ├── sodex.ts              # EIP-712 signing + SoDEX order placement
        │   ├── telegram.ts           # Telegram notification service
        │   ├── tradeHistory.ts       # localStorage trade execution history
        │   └── alerts.ts             # Smart alert derivation from ETF flows
        │
        ├── components/
        │   ├── AppShell.tsx          # Layout: Header + TickerStrip + Sidebar + WalletGate
        │   ├── SignalPanel.tsx        # AI signal card with factor weight breakdown bars
        │   ├── SignalHistory.tsx      # Signal archive with cumulative PnL chart (recharts)
        │   ├── TradeModal.tsx         # EIP-712 trade modal with order proof on success
        │   ├── MarketShareDonut.tsx   # Recharts PieChart — top-6 funds + Other bucket
        │   ├── SentimentGauge.tsx     # Animated SVG half-circle gauge
        │   └── ...                   # (12 more components)
        │
        └── pages/app/
            ├── TradePage.tsx          # SoDEX trade UI + Telegram link card + execution history
            └── SignalsPage.tsx        # Signals hub with performance tracking
```

---

## 📡 API & Data Integration

| Source | Endpoint / Protocol | Purpose |
|--------|---------------------|---------|
| **SoSoValue** | `POST /openapi/v2/etf/currentEtfDataMetrics` | Live BTC/ETH ETF flows, net assets, fund breakdown |
| **SoSoValue** | `GET /api/v1/news/featured` | Categorised crypto news feed |
| **Binance** | `wss://stream.binance.com:9443/stream` | Live BTC/ETH price — `miniTicker` ~1s updates |
| **Claude AI** | `claude-sonnet-4-6` via `/api/analyze` | Signal synthesis + AskAI follow-up |
| **SoDEX Testnet** | `POST testnet-gw.sodex.dev/api/v1/spot/trade/orders/batch` | EIP-712 signed spot order placement |
| **Upstash Redis** | REST API | Signal archive (100 signals) + Telegram subscribers + wallet links |
| **chart-img.com** | `GET /v1/tradingview/advanced-chart` | TradingView-style chart images for bot |
| **Public ETH RPC** | `eth_feeHistory` (LlamaRPC/Cloudflare) | Ethereum gas prices (no API key needed) |

---

## 📊 Signal Output Schema

```typescript
interface MarketSignal {
  direction:   'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence:  number;        // 0–100
  headline:    string;        // One punchy sentence
  summary:     string;        // 2–3 sentences with specific numbers
  keyFactors:  string[];      // Top 3 drivers
  tradeIdea:   string;        // Actionable suggestion referencing SoDEX
  riskWarning: string;        // Main risk to the thesis
  entryZone:   { low: number; high: number };   // Optimal entry price range
  takeProfit:  { price: number; pct: number; rationale: string };
  stopLoss:    { price: number; pct: number; rationale: string };
  weights: [                  // Factor breakdown — always 4 entries summing to 100
    { factor: string; weight: number; signal: 'positive'|'negative'|'neutral' },
    ...
  ];
  timestamp:   Date;
}
```

---

## 🛡️ Safety & Risk Controls

- **Explicit risk acknowledgment** — checkbox required before any trade executes
- **Risk warning displayed** — Claude's risk thesis shown before confirmation
- **Confidence score** — visual bar shows AI certainty (0–100%)
- **TP/SL levels** — concrete price targets with rationale for every signal
- **Testnet-only** — all trades go to SoDEX testnet (`chainId: 138565`), no real funds
- **"Not financial advice"** — displayed on every signal card and trade modal
- **Order proof** — Order ID + status shown after every successful submission
- **API key isolation** — All server keys live only in Vercel Edge Functions, never in the browser

---

## 🗺️ Buildathon Roadmap

```
Wave 1  ✅  Full scaffold · SoSoValue live data · Claude AI signals · SoDEX EIP-712 trades
            5-page app shell · Bloomberg ticker · Binance live price stream (● LIVE indicator)
            Recharts interactive charts · Sentiment gauge · AskAI chat · Alerts feed
            Dynamic multi-wallet · Wallet-gated dashboard · Density toggle

Wave 2  ✅  Signal archive (Upstash Redis) · Real 24h performance evaluation
            TP/SL levels + entry zone in every signal · Factor weight breakdown bars
            Telegram bot (@ETFSignalAIBot) with /signal, /chart, /gas commands
            Wallet↔Telegram linking · Personal trade alerts via bot
            Trade execution history (localStorage) · Order proof card (Order ID + status)
            SoDEX balance proxy · Faucet link · Spot order schema fixes

Wave 3  🔜  Signal accuracy leaderboard · Copy-trading module · Portfolio P&L tracker
```

---

## ⚖️ Judging Criteria Coverage

| Criterion | Weight | ETFSignal AI |
|-----------|--------|-------------|
| User Value & Practical Impact | **30%** | Turns institutional ETF flow data into plain-English signals with TP/SL levels a retail trader can act on in seconds |
| Functionality & Working Demo | **25%** | Live at etfsignal.vercel.app — full pipeline: live data → AI signal → EIP-712 trade → Telegram alert |
| Logic, Workflow & Product Design | **20%** | 6-page app, shared data context, signal archive with 24h real evaluation, trade history, bot integration |
| Data / API Integration | **15%** | SoSoValue + Binance WS + Claude AI + SoDEX testnet + Upstash Redis + chart-img.com + Ethereum RPC |
| UX & Clarity | **10%** | Bloomberg cockpit, recharts, live ticker, Dynamic wallet, factor breakdown bars, Telegram alerts |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 + CSS custom properties (dark/light themes) |
| Routing | React Router v7 (nested routes with shared context) |
| Charts | Recharts 3 — ComposedChart, PieChart, BarChart, LineChart |
| Animations | Framer Motion |
| Wallet | Dynamic (`@dynamic-labs/sdk-react-core`) — MetaMask, Rabby, WalletConnect + 300 more |
| Web3 | ethers.js v6 (EIP-712 signing via Dynamic signer) |
| Live Data | Binance WebSocket `miniTicker` stream (BTC + ETH, ~1s cadence) |
| AI | Anthropic Claude `claude-sonnet-4-6` (Vercel Node.js Function) |
| Data | SoSoValue REST API |
| Trading | SoDEX Testnet REST (EIP-712 signed spot orders, symbolID-based) |
| Persistence | Upstash Redis (REST API — signal archive, subscribers, wallet links) |
| Bot | Telegram Bot API (Vercel Edge Function webhook) |
| Charts (Bot) | chart-img.com (TradingView-style) + QuickChart.io (fallback) |
| Deploy | Vercel (Edge + Node.js Functions) |

---

## 🚢 Deploy to Vercel

```bash
npm run build
npx vercel --prod
```

Add environment variables in Vercel → **Settings → Environment Variables** (see table above).

After deploying, register the Telegram webhook once:

```bash
TELEGRAM_BOT_TOKEN=your_token node scripts/setup-telegram-webhook.js
```

---

## 👤 Builder

**MrG** — Solo / One-Person submission

- 🐦 X: [@theinvisivle](https://x.com/theinvisivle)
- 🐙 GitHub: [github.com/girume1](https://github.com/girume1)
- 🎮 Discord: `mrgt_07`
- 🏆 Akindo: [app.akindo.io/users/MrG](https://app.akindo.io/users/MrG)

---

<div align="center">

**ETFSignal AI** · SoSoValue Buildathon 2026 · Wave 2

*Data by [SoSoValue](https://sosovalue.com) · Live prices by [Binance](https://binance.com) · Trading on [SoDEX Testnet](https://sodex.com) · AI by [Anthropic Claude](https://anthropic.com) · Wallet by [Dynamic](https://dynamic.xyz) · Bot on [Telegram](https://t.me/ETFSignalAIBot)*

</div>
