<div align="center">

```
███████╗████████╗███████╗███████╗██╗ ██████╗ ███╗   ██╗ █████╗ ██╗
██╔════╝╚══██╔══╝██╔════╝██╔════╝██║██╔════╝ ████╗  ██║██╔══██╗██║
█████╗     ██║   █████╗  ███████╗██║██║  ███╗██╔██╗ ██║███████║██║
██╔══╝     ██║   ██╔══╝  ╚════██║██║██║   ██║██║╚██╗██║██╔══██║██║
███████╗   ██║   ██║     ███████║██║╚██████╔╝██║ ╚████║██║  ██║███████╗
╚══════╝   ╚═╝   ╚═╝     ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
                                                              AI ⚡
```

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

It pulls institutional ETF flow data from SoSoValue, computes a live sentiment score, synthesizes everything with Claude AI into a clear market signal, then lets you execute the trade directly on SoDEX testnet — all from one dashboard with 5 focused views.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SoSoValue API          Claude AI           SoDEX Testnet     │
│   ─────────────    →    ───────────    →    ─────────────────  │
│   ETF Flows             Synthesize           Place Order       │
│   News Feed             Signal               EIP712 Sign       │
│   Fund Data             Risk Score           Confirm Trade     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Demo Mode:** If the SoSoValue API key is missing or invalid the app automatically falls back to realistic mock data — the full UI remains interactive for judges and reviewers.

---

## 🎯 The Full Pipeline

| Step | What Happens |
|------|-------------|
| **1. Ingest** | Fetches live BTC & ETH spot ETF metrics — daily inflows, net assets, cumulative flows, per-fund breakdown |
| **2. Sentiment** | Computes a 0–100 flow sentiment score from 14-day momentum + inflow breadth |
| **3. Enrich** | Pulls categorised news: on-chain events, institutional reports, price alerts, research |
| **4. Analyze** | Claude AI synthesises everything into a structured signal: direction, confidence, key factors, risk warning |
| **5. Signal** | Dashboard shows BULLISH / BEARISH / NEUTRAL with headline, summary, trade idea, AskAI follow-up chat |
| **6. Execute** | User connects MetaMask, reviews order, acknowledges risk, signs via EIP712, submits to SoDEX testnet |

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
- MetaMask browser extension
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

# SERVER-SIDE — used only by /api/analyze edge function (never sent to browser)
ANTHROPIC_API_KEY=sk-ant-...

# CLIENT-SIDE — leave as placeholder to run in demo/mock mode
VITE_SOSOVALUE_API_KEY=your_sosovalue_api_key_here
```

> **Security note:** `ANTHROPIC_API_KEY` has **no** `VITE_` prefix — it is a server-only variable consumed by the Vercel Edge Function `/api/analyze`. It is never bundled into the browser build.

### 3. Run

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🔑 API Keys Setup

<details>
<summary><strong>SoSoValue API Key</strong></summary>

1. Visit [sosovalue.gitbook.io/soso-value-api-doc](https://sosovalue.gitbook.io/soso-value-api-doc)
2. Apply for buildathon access via [forms.gle/2nuJT2qNbUQsyyZy8](https://forms.gle/2nuJT2qNbUQsyyZy8)
3. Once approved, add to `.env` as `VITE_SOSOVALUE_API_KEY`

Without a key the app runs in **demo mode** — a yellow "Demo Data" pill appears in the header, and all data comes from realistic mock data matching the real API shape.

</details>

<details>
<summary><strong>Anthropic Claude API Key</strong></summary>

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys** → **Create Key**
3. Add to `.env` as `ANTHROPIC_API_KEY` (no `VITE_` prefix — server-only)

</details>

<details>
<summary><strong>SoDEX Testnet Wallet Setup</strong></summary>

1. Install [MetaMask](https://metamask.io)
2. Visit [sodex.com](https://sodex.com) and connect
3. Follow [Testnet Onboarding Steps](https://sodex.com/documentation/resources/testnet-onboarding-steps):
   - Connect whitelisted wallet
   - Claim test tokens
   - Add ValueChain to MetaMask (`chainId: 138565`)
   - Transfer test tokens to Spot Account
   - Enable gas-free trading
4. Click **Connect Wallet** in ETFSignal AI — dropdown shows copy address, explorer link, and disconnect

</details>

---

## 🏗️ Architecture

```
app/
├── api/
│   └── analyze.ts              # Vercel Edge Function — Claude proxy (keeps API key server-side)
│
├── src/
│   ├── contexts/
│   │   ├── DashboardContext.tsx # Shared data + wallet + signal state for all /app/* pages
│   │   └── DensityContext.tsx   # Layout density (compact / comfortable / mobile) + localStorage
│   │
│   ├── components/
│   │   ├── AppShell.tsx         # Header + TickerStrip + Sidebar + <Outlet />
│   │   ├── AppSidebar.tsx       # Sticky sidebar nav with active-route highlight + alert badge
│   │   ├── Header.tsx           # Logo + DensityToggle + WalletMenu
│   │   ├── WalletMenu.tsx       # Dropdown: copy address · explorer link · disconnect
│   │   ├── DensityToggle.tsx    # Mobile / Compact / Comfortable switcher
│   │   ├── TickerStrip.tsx      # Bloomberg-style scrolling marquee
│   │   ├── QuickStats.tsx       # 4-card stats bar (AUM · flows · sentiment · alerts)
│   │   ├── EtfPanel.tsx         # BTC/ETH tab · metrics · fund breakdown table · anomaly badges
│   │   ├── SentimentGauge.tsx   # SVG half-circle gauge (0–100 flow momentum score)
│   │   ├── PriceFlowChart.tsx   # Combined SVG: price line + inflow bars, shared x-axis
│   │   ├── MarketShareDonut.tsx # SVG donut — top-6 funds + Other bucket
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
│   └── App.tsx                  # BrowserRouter + DensityProvider + nested /app routes
│
├── .env.example
└── README.md
```

---

## 📡 API Integration

| API | Endpoint | Purpose |
|-----|----------|---------|
| **SoSoValue** | `POST /openapi/v2/etf/currentEtfDataMetrics` | Live BTC/ETH ETF flows, net assets, holdings |
| **SoSoValue** | `GET /api/v1/news/featured` | Crypto news — filtered by category |
| **Claude AI** | `claude-sonnet-4-20250514` (server-side) | Market signal synthesis + AskAI chat |
| **SoDEX Testnet** | `POST testnet-gw.sodex.dev/api/v1/spot/order` | EIP712-signed spot order placement |
| **SoDEX Testnet** | `wss://testnet-gw.sodex.dev/ws/spot` | Real-time price feed (Wave 2) |

### Mock Mode

When `VITE_SOSOVALUE_API_KEY` is empty or a placeholder, all fetchers return from `mockData.ts`:
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
- **API key isolation** — Anthropic key lives only in Vercel Edge Function, never in the browser bundle

---

## 🗺️ Buildathon Roadmap

```
Wave 1  ✅  Full scaffold · SoSoValue mock+live data · Claude AI signals · SoDEX EIP712 trades
            5-page app shell · Bloomberg ticker · Sentiment gauge · Price/flow charts
            Market-share donut · AskAI chat · Alerts feed · Signal archive · Wallet menu
            Density toggle (mobile/compact/comfortable) · Landing hero visualization

Wave 2  🔜  Real-time WebSocket price feed · SoSoValue historical API endpoint
            AI trade suggestions with TP/SL · Portfolio P&L tracker

Wave 3  🔜  Copy-trading module · Risk scoring dashboard · Final demo polish
```

---

## ⚖️ Judging Criteria Coverage

| Criterion | Weight | ETFSignal AI |
|-----------|--------|-------------|
| User Value & Practical Impact | **30%** | Turns institutional ETF flow data into plain-English signals a retail trader can act on in seconds |
| Functionality & Working Demo | **25%** | Live at etfsignal.vercel.app — full pipeline: data → sentiment → AI signal → EIP712 trade |
| Logic, Workflow & Product Design | **20%** | 5-page app shell, shared data context, density-responsive layouts, sidebar navigation |
| Data / API Integration | **15%** | SoSoValue API + mock-mode fallback + Claude AI (server-side) + SoDEX testnet EIP712 |
| UX & Clarity | **10%** | Bloomberg-style cockpit, density toggle, animated hero, wallet dropdown with copy/disconnect |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 + CSS custom properties + custom SVG charts |
| Routing | React Router v6 (nested routes with shared context) |
| Web3 | ethers.js v6 (EIP712 signing) |
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
| `VITE_SOSOVALUE_API_KEY` | Your SoSoValue key | Client + Server |

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

*Data by [SoSoValue](https://sosovalue.com) · Trading on [SoDEX Testnet](https://sodex.com) · AI by [Anthropic Claude](https://anthropic.com)*

</div>
