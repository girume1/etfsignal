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

It pulls institutional ETF flow data from SoSoValue, streams live BTC/ETH prices from Binance, computes a live sentiment score, synthesizes everything with Claude AI into a clear market signal, then lets you execute the trade directly on SoDEX testnet — all from one dashboard with 5 focused views.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SoSoValue API          Claude AI           SoDEX Testnet     │
│   ─────────────    →    ───────────    →    ─────────────────  │
│   ETF Flows             Synthesize           Place Order       │
│   News Feed             Signal               EIP712 Sign       │
│   Fund Data             Risk Score           Confirm Trade     │
│                                                                 │
│   Binance WS                                                    │
│   ──────────                                                    │
│   Live BTC/ETH price (1s updates)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Demo Mode:** If the SoSoValue API key is missing or invalid the app automatically falls back to realistic mock data — the full UI remains interactive for judges and reviewers.

---

## 🎯 The Full Pipeline

| Step | What Happens |
|------|-------------|
| **1. Ingest** | Fetches live BTC & ETH spot ETF metrics — daily inflows, net assets, cumulative flows, per-fund breakdown |
| **2. Live Price** | Streams real-time BTC/ETH price from Binance WebSocket (~1s cadence); auto-reconnects |
| **3. Sentiment** | Computes a 0–100 flow sentiment score from 14-day momentum + inflow breadth |
| **4. Enrich** | Pulls categorised news: on-chain events, institutional reports, price alerts, research |
| **5. Analyze** | Claude AI synthesises everything into a structured signal: direction, confidence, key factors, risk warning |
| **6. Signal** | Dashboard shows BULLISH / BEARISH / NEUTRAL with headline, summary, trade idea, AskAI follow-up chat |
| **7. Execute** | User connects wallet via Dynamic, reviews order, acknowledges risk, signs via EIP712, submits to SoDEX testnet |

---

## 🖥️ App Pages

The app is split into 5 focused views, all sharing one live data context (no re-fetch on navigation):

| Route | Purpose |
|-------|---------|
| `/app` | **Overview** — full cockpit: ETF panels, price/flow chart, donut, sentiment gauge, signal, alerts, news |
| `/app/flows` | **Flows** — BTC + ETH inflow charts and market-share donuts side-by-side |
| `/app/signals` | **Signals** — sentiment gauge, AI signal, AskAI chat, signal archive, how-it-works explainer |
| `/app/alerts` | **Alerts** — filterable grid of smart flow & anomaly alerts (by type + severity) |
| `/app/news` | **News** — searchable news grid with category filter |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ / pnpm 9+
- Any EVM wallet (MetaMask recommended)
- SoSoValue API key ([apply here](https://forms.gle/2nuJT2qNbUQsyyZy8)) — *app works in demo mode without one*
- Anthropic API key ([get here](https://console.anthropic.com))

### 1. Clone & Install

```bash
git clone https://github.com/girume1/etfsignal.git
cd etfsignal/app
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

```env
# .env

# SERVER-SIDE — consumed by Vercel Edge Functions only, never sent to browser
ANTHROPIC_API_KEY=sk-ant-...
SOSOVALUE_API_KEY=SOSO-...

# CLIENT-SIDE (VITE_ prefix = bundled into browser)
VITE_DYNAMIC_ENVIRONMENT_ID=your_dynamic_environment_id_here
```

> **Security note:** Both `ANTHROPIC_API_KEY` and `SOSOVALUE_API_KEY` have **no** `VITE_` prefix — they are server-only variables consumed by Vercel Edge Functions (`/api/analyze` and `/api/sosovalue`). They are never bundled into the browser build.

### 3. Run

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🔑 API Keys Setup

<details>
<summary><strong>SoSoValue API Key</strong></summary>

1. Visit [sosovalue.com/developer/dashboard](https://sosovalue.com/developer/dashboard) to get your key
2. Add to `.env` as `SOSOVALUE_API_KEY` (no `VITE_` prefix — server-only)
3. Add the same key to Vercel → Settings → Environment Variables

All SoSoValue requests are proxied through `/api/sosovalue` (Vercel Edge Function) — the key never reaches the browser. Without a key the app runs in **demo mode** — a yellow "Demo Data" pill appears in the header, and all data comes from realistic mock data matching the real API shape.

</details>

<details>
<summary><strong>Anthropic Claude API Key</strong></summary>

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys** → **Create Key**
3. Add to `.env` as `ANTHROPIC_API_KEY` (no `VITE_` prefix — server-only)

</details>

<details>
<summary><strong>Wallet Setup (Dynamic)</strong></summary>

ETFSignal AI uses [Dynamic](https://dynamic.xyz) for wallet connections — supports MetaMask, WalletConnect, Coinbase Wallet, and 300+ EVM wallets.

1. Click **Connect Wallet** in the app header
2. Select your wallet from the Dynamic modal
3. For SoDEX testnet trading, follow [Testnet Onboarding Steps](https://sodex.com/documentation/resources/testnet-onboarding-steps):
   - Connect whitelisted wallet
   - Claim test tokens
   - Add ValueChain to MetaMask (`chainId: 138565`)
   - Transfer test tokens to Spot Account
   - Enable gas-free trading

Once connected, the header shows your address with a dropdown for: copy address · view on explorer · disconnect.

</details>

---

## 🏗️ Architecture

```
app/
├── api/
│   ├── analyze.ts              # Vercel Edge Function — Claude proxy (ANTHROPIC_API_KEY server-side)
│   └── sosovalue.ts            # Vercel Edge Function — SoSoValue proxy (SOSOVALUE_API_KEY server-side)
│
├── src/
│   ├── contexts/
│   │   ├── DashboardContext.tsx # Shared data + wallet + signal state for all /app/* pages
│   │   └── DensityContext.tsx   # Layout density (compact / comfortable / mobile) + localStorage
│   │
│   ├── hooks/
│   │   └── useLivePrices.ts     # Binance WebSocket hook — live BTC/ETH price stream
│   │
│   ├── components/
│   │   ├── AppShell.tsx         # Header + TickerStrip + Sidebar + <Outlet />
│   │   ├── AppSidebar.tsx       # Sticky sidebar nav with active-route highlight + alert badge
│   │   ├── Header.tsx           # Logo + DensityToggle + WalletMenu
│   │   ├── WalletMenu.tsx       # Dropdown: copy address · explorer link · disconnect
│   │   ├── DensityToggle.tsx    # Mobile / Compact / Comfortable switcher
│   │   ├── TickerStrip.tsx      # Bloomberg-style marquee + LIVE indicator
│   │   ├── QuickStats.tsx       # 4-card stats bar — live BTC/ETH price + sentiment + alerts
│   │   ├── EtfPanel.tsx         # BTC/ETH tab · metrics · fund breakdown table · anomaly badges
│   │   ├── SentimentGauge.tsx   # SVG half-circle gauge (0–100 flow momentum score)
│   │   ├── PriceFlowChart.tsx   # Recharts ComposedChart: price line + inflow bars, dual Y axes
│   │   ├── MarketShareDonut.tsx # Recharts PieChart donut — top-6 funds + Other bucket
│   │   ├── InflowChart.tsx      # Recharts BarChart — 14-day net inflow sparkline
│   │   ├── SignalPanel.tsx      # AI signal card + Long/Short trade buttons
│   │   ├── AskAI.tsx            # Follow-up chat — routed through /api/analyze
│   │   ├── AlertsPanel.tsx      # Severity-glow alert feed (5 kinds)
│   │   ├── SignalHistory.tsx    # Timeline of past signals with mock P&L badges
│   │   ├── NewsFeed.tsx         # Categorised live news feed
│   │   ├── TradeModal.tsx       # Risk-acknowledged EIP712 trade confirmation
│   │   ├── DemoBanner.tsx       # Dismissable banner in mock/demo mode
│   │   └── HeroVisualizer.tsx   # Animated flow→AI→signal pipeline (landing page)
│   │
│   ├── pages/
│   │   ├── LandingPage.tsx      # Marketing hero with HeroVisualizer
│   │   ├── HowItWorksPage.tsx   # Product explainer
│   │   ├── AboutPage.tsx        # Builder profile + buildathon context
│   │   └── app/
│   │       ├── OverviewPage.tsx # /app — full cockpit (3-col grid)
│   │       ├── FlowsPage.tsx    # /app/flows — BTC+ETH charts side-by-side
│   │       ├── SignalsPage.tsx  # /app/signals — gauge + signal + AskAI + archive
│   │       ├── AlertsPage.tsx   # /app/alerts — filterable alerts grid
│   │       └── NewsPage.tsx     # /app/news — searchable news with category filter
│   │
│   ├── services/
│   │   ├── sosovalue.ts         # SoSoValue API + mock fallback (auto-degrades on 401)
│   │   ├── mockData.ts          # Realistic mock ETF data, news, alerts, signals
│   │   ├── ai.ts                # Claude signal synthesis + AskAI follow-up
│   │   └── sodex.ts             # EIP712 signing + SoDEX testnet order placement
│   │
│   ├── types/index.ts           # Full TypeScript definitions
│   └── App.tsx                  # DynamicContextProvider + BrowserRouter + nested /app routes
│
├── .env.example
└── README.md
```

---

## 📡 API & Data Integration

| Source | Endpoint / Protocol | Purpose |
|--------|---------------------|---------|
| **SoSoValue** | `POST /openapi/v2/etf/currentEtfDataMetrics` | Live BTC/ETH ETF flows, net assets, fund breakdown |
| **SoSoValue** | `GET /api/v1/news/featured` | Categorised crypto news feed |
| **Binance** | `wss://stream.binance.com:9443/stream` | Live BTC/ETH price — `miniTicker` ~1s updates |
| **Claude AI** | `claude-sonnet-4-20250514` (server-side) | Market signal synthesis + AskAI follow-up chat |
| **SoDEX Testnet** | `POST testnet-gw.sodex.dev/api/v1/spot/order` | EIP712-signed spot order placement |

### Mock Mode

When `SOSOVALUE_API_KEY` is not set in Vercel, the `/api/sosovalue` proxy returns `{ noKey: true }` and the client automatically falls back to `mockData.ts`:
- 10 BTC funds (IBIT, FBTC, ARKB, BITB, HODL, BRRR, BTCO, EZBC, BTC, GBTC)
- 9 ETH funds (ETHA, FETH, ETHW, CETH, ETHV, QETH, EZET, ETH, ETHE)
- 14-day inflow series + price history per asset
- 5 smart alerts + 4 historical signals with mock P&L
- 12 realistic news headlines

If a real key returns 401, the session silently degrades to mocks — no crash, no empty UI.

### Signal Output Schema

```typescript
interface MarketSignal {
  direction:   'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence:  number;        // 0–100
  headline:    string;        // One punchy sentence
  summary:     string;        // 2–3 sentences with specific numbers
  keyFactors:  string[];      // Top 3 drivers
  tradeIdea:   string;        // Actionable suggestion
  riskWarning: string;        // Main risk to the thesis
  timestamp:   Date;
}
```

---

## 🛡️ Safety & Risk Controls

- **Explicit risk acknowledgment** — checkbox required before any trade executes
- **Risk warning displayed** — Claude's risk thesis shown prominently before confirmation
- **Confidence score** — visual bar shows AI certainty (0–100%)
- **Testnet-only** — all trades go to SoDEX testnet (`chainId: 138565`), no real funds
- **"Not financial advice"** — displayed on every signal card and trade modal
- **Trade review step** — full order details visible (symbol, side, quantity) before signing
- **API key isolation** — Both Anthropic and SoSoValue keys live only in Vercel Edge Functions, never in the browser bundle

---

## 🗺️ Buildathon Roadmap

```
Wave 1  ✅  Full scaffold · SoSoValue mock+live data · Claude AI signals · SoDEX EIP712 trades
            5-page app shell · Bloomberg ticker · Binance live price stream (● LIVE indicator)
            Recharts interactive charts (price+flow, donut, inflow bars)
            Sentiment gauge · AskAI chat · Alerts feed · Signal archive
            Dynamic multi-wallet (MetaMask, WalletConnect, Coinbase + 300 more)
            Density toggle (mobile/compact/comfortable) · Landing hero visualization

Wave 2  🔜  SoDEX WebSocket real-time order book · SoSoValue historical API endpoint
            AI trade suggestions with TP/SL · Portfolio P&L tracker

Wave 3  🔜  Copy-trading module · Risk scoring dashboard · Final demo polish
```

---

## ⚖️ Judging Criteria Coverage

| Criterion | Weight | ETFSignal AI |
|-----------|--------|-------------|
| User Value & Practical Impact | **30%** | Turns institutional ETF flow data into plain-English signals a retail trader can act on in seconds |
| Functionality & Working Demo | **25%** | Live at etfsignal.vercel.app — full pipeline: live data → sentiment → AI signal → EIP712 trade |
| Logic, Workflow & Product Design | **20%** | 5-page app shell, shared data context, density-responsive layouts, sidebar navigation |
| Data / API Integration | **15%** | SoSoValue + Binance WS live prices + Claude AI (server-side) + SoDEX testnet EIP712 |
| UX & Clarity | **10%** | Bloomberg cockpit, Recharts charts, live price ticker, Dynamic wallet, density toggle |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Routing | React Router v7 (nested routes with shared context) |
| Charts | Recharts 3 — ComposedChart, PieChart, BarChart |
| Wallet | Dynamic (`@dynamic-labs/sdk-react-core`) — MetaMask, WalletConnect, Coinbase + 300 more |
| Web3 | ethers.js v6 (EIP712 signing via Dynamic signer) |
| Live Data | Binance WebSocket `miniTicker` stream (BTC + ETH, ~1s cadence) |
| AI | Anthropic Claude `claude-sonnet-4-20250514` (Vercel Edge Function) |
| Data | SoSoValue REST API + realistic mock fallback |
| Trading | SoDEX Testnet REST (EIP712 signed orders) |
| Deploy | Vercel (Edge Functions for API proxy) |

---

## 🚢 Deploy to Vercel

```bash
pnpm build
npx vercel --prod
```

Add environment variables in Vercel dashboard → **Settings → Environment Variables**:

| Key | Value | Visibility |
|-----|-------|-----------|
| `ANTHROPIC_API_KEY` | Your Anthropic key | **Server only** (no VITE_ prefix) |
| `SOSOVALUE_API_KEY` | Your SoSoValue key | **Server only** (no VITE_ prefix) |
| `VITE_DYNAMIC_ENVIRONMENT_ID` | Your Dynamic environment ID | Client (public) |

---

## 👤 Builder

**MrG** — Solo / One-Person submission

- 🐦 X: [@theinvisivle](https://x.com/theinvisivle)
- 🐙 GitHub: [github.com/girume1](https://github.com/girume1)
- 🎮 Discord: `mrgt_07`
- 🏆 Akindo: [app.akindo.io/users/MrG](https://app.akindo.io/users/MrG)

---

<div align="center">

**ETFSignal AI** · SoSoValue Buildathon 2026 · Wave 1

*Data by [SoSoValue](https://sosovalue.com) · Live prices by [Binance](https://binance.com) · Trading on [SoDEX Testnet](https://sodex.com) · AI by [Anthropic Claude](https://anthropic.com) · Wallet by [Dynamic](https://dynamic.xyz)*

</div>
