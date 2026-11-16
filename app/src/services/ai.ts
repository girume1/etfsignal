import type { EtfData, NewsItem, MarketSignal } from '../types';
import { getNewsTitle, formatUSD } from './sosovalue';

export type AnalysisStage =
  | 'fetching_data'
  | 'calculating_momentum'
  | 'calling_agent'
  | 'validating_signal'
  | 'ready';

/** Requirement 2.10, 4.7: optional quantitative context appended to the AI prompt. */
export interface SignalContext {
  backtestSummary?: { hitRate: number; avgPnl: number; sampleSize: number };
  flow30dTotal?: number;
  flow90dTotal?: number;
  sosoValueMs?: number;
  marketDataMs?: number;
  onStageChange?: (stage: AnalysisStage) => void;
  signal?: AbortSignal;
}

export interface SignalTimingBreakdown {
  sosoValueMs: number;
  marketDataMs: number;
  dataProcessingMs: number;
  geminiApiMs: number;
  validationMs: number;
  totalMs: number;
}

let lastSignalTiming: SignalTimingBreakdown | null = null;

export function getLastSignalTiming(): SignalTimingBreakdown | null {
  return lastSignalTiming;
}

// Short-lived cache & in-flight deduplication to avoid duplicate Gemini requests for identical market state
const SIGNAL_CACHE_TTL_MS = 45_000;
const CLIENT_ANALYZE_TIMEOUT_MS = 16_000;
const signalCache = new Map<string, { signal: MarketSignal; ts: number }>();
const inflightRequests = new Map<string, Promise<MarketSignal>>();

export function clearSignalCache(): void {
  signalCache.clear();
  inflightRequests.clear();
}

export function buildPrompt(
  etfType: 'BTC' | 'ETH',
  etfData: EtfData,
  news: NewsItem[],
  currentPrice: number | null,
  context: SignalContext = {},
): string {
  const inflow = etfData.dailyNetInflow.value;
  const cumInflow = etfData.cumNetInflow.value;
  const netAssets = etfData.totalNetAssets.value;
  const holdings = etfData.totalTokenHoldings.value;

  const trackRecord = context.backtestSummary
    ? `\n## Signal Track Record (last ${context.backtestSummary.sampleSize} real-evaluated signals)\n- Hit Rate: ${context.backtestSummary.hitRate}%\n- Avg P&L: ${context.backtestSummary.avgPnl.toFixed(2)}%\n`
    : '';

  const flowWindows = (context.flow30dTotal !== undefined || context.flow90dTotal !== undefined)
    ? `\n## Extended Flow Context\n- 30-Day Net Flow: ${context.flow30dTotal !== undefined ? formatUSD(context.flow30dTotal) : 'unavailable'}\n- 90-Day Net Flow: ${context.flow90dTotal !== undefined ? formatUSD(context.flow90dTotal) : 'unavailable'}\n`
    : '';

  const topFunds = etfData.list
    .filter(f => f.dailyNetInflow.value !== null)
    .sort((a, b) => Math.abs(b.dailyNetInflow.value!) - Math.abs(a.dailyNetInflow.value!))
    .slice(0, 5)
    .map(f => `  - ${f.ticker} (${f.institute}): ${formatUSD(f.dailyNetInflow.value)} daily inflow, fee ${((f.fee.value || 0) * 100).toFixed(2)}%`)
    .join('\n');

  const recentNews = news
    .slice(0, 8)
    .map(n => `  - [${n.category}] ${getNewsTitle(n)}`)
    .join('\n');

  const priceContext = currentPrice
    ? `- Current ${etfType} Price: $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '';

  return `You are a professional crypto market analyst. Analyze the following ${etfType} spot ETF data and recent news, then produce a structured market signal with precise TP/SL levels.

## ${etfType} Market Data (Live)
${priceContext}
- Total Net Assets: ${formatUSD(netAssets)}
- Daily Net Inflow: ${formatUSD(inflow)}
- Cumulative Net Inflow: ${formatUSD(cumInflow)}
- Total ${etfType} Holdings: ${holdings?.toLocaleString() || '—'} ${etfType}
${trackRecord}${flowWindows}
## Top Fund Flows
${topFunds || '  No data available'}

## Recent News Headlines
${recentNews || '  No recent news'}

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

// ─── Follow-up Q&A chat ──────────────────────────────────────────────────
// Powers the AskAI panel. Keeps context (prior signal + data summary) so the
// user can drill in: "why is IBIT up?", "what's the risk if outflows continue?",
// "compare BTC vs ETH flows" — all routed through the same /api/analyze proxy.

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function askFollowUp(
  etfType: 'BTC' | 'ETH',
  etfData: EtfData,
  signal: MarketSignal | null,
  history: ChatTurn[],
  question: string,
): Promise<string> {
  const inflow    = formatUSD(etfData.dailyNetInflow.value);
  const netAssets = formatUSD(etfData.totalNetAssets.value);
  const topFlows  = etfData.list
    .filter(f => f.dailyNetInflow.value !== null)
    .sort((a, b) => Math.abs(b.dailyNetInflow.value!) - Math.abs(a.dailyNetInflow.value!))
    .slice(0, 5)
    .map(f => `${f.ticker}: ${formatUSD(f.dailyNetInflow.value)}`).join(', ');

  const systemContext = `You are The Agent, ETFSignalAI's market intelligence assistant. You just produced this signal for ${etfType}:
${signal ? `Direction: ${signal.direction} · Confidence: ${signal.confidence}%
Headline: ${signal.headline}
Summary: ${signal.summary}` : 'No prior signal yet — answer from the data below.'}

Current data snapshot:
- Total net assets: ${netAssets}
- Daily net inflow: ${inflow}
- Top flows: ${topFlows}

Answer the user's question concisely (2-4 sentences max). Reference specific numbers. Do not repeat the summary verbatim. If the question is off-topic, politely steer back to ETF flows.`;

  // Truncate history to the last 10 turns to keep context manageable
  const recentHistory = history.slice(-10);

  const messages = [
    ...recentHistory.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: question },
  ];

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 400,
      system: systemContext,
      messages,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text || '(no response)';
}

export async function analyzeMarket(
  etfType: 'BTC' | 'ETH',
  etfData: EtfData,
  news: NewsItem[],
  currentPrice?: number | null,
  context: SignalContext = {},
): Promise<MarketSignal> {
  const tStart = performance.now();
  const sosoValueMs = context.sosoValueMs ?? 0;
  const marketDataMs = context.marketDataMs ?? 0;

  // Deduplicate concurrent identical requests when real ETF data is present
  const hasRealData = etfData.dailyNetInflow.value !== null || etfData.totalNetAssets.value !== null;
  const priceBucket = currentPrice ? Math.round(currentPrice / 50) * 50 : 0;
  const cacheKey = `${etfType}:${etfData.dailyNetInflow.value ?? 'null'}:${news.length}:${priceBucket}`;

  if (hasRealData) {
    const cached = signalCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SIGNAL_CACHE_TTL_MS) {
      context.onStageChange?.('ready');
      return cached.signal;
    }
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const runAnalysis = async (): Promise<MarketSignal> => {
    if (context.signal?.aborted) {
      throw new DOMException('Analysis cancelled', 'AbortError');
    }

    context.onStageChange?.('calculating_momentum');
    const tPromptStart = performance.now();
    const prompt = buildPrompt(etfType, etfData, news, currentPrice ?? null, context);
    const dataProcessingMs = Math.round(performance.now() - tPromptStart);

    context.onStageChange?.('calling_agent');
    const tGeminiStart = performance.now();

    // Combine caller AbortSignal with client-side timeout so requests never hang indefinitely
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), CLIENT_ANALYZE_TIMEOUT_MS);
    const onCallerAbort = () => timeoutController.abort();
    context.signal?.addEventListener('abort', onCallerAbort, { once: true });

    let response: Response;
    try {
      response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
        ...(context.signal ? { signal: timeoutController.signal } : {}),
      });
    } catch (err: any) {
      if (context.signal?.aborted) {
        throw new DOMException('Analysis cancelled', 'AbortError');
      }
      if (timeoutController.signal.aborted || err?.name === 'AbortError') {
        throw new Error('The Agent timed out waiting for a response. Please click Retry.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      context.signal?.removeEventListener('abort', onCallerAbort);
    }

    if (!response.ok) {
      let errMessage = `AI API error: ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error && typeof errBody.error === 'string') {
          errMessage = response.status === 504
            ? `${errBody.error} (HTTP 504)`
            : errBody.error;
        }
      } catch {
        // keep default status error message
      }
      throw new Error(errMessage);
    }

    const data = await response.json();
    const geminiApiMs = Math.round(performance.now() - tGeminiStart);
    const text = data.content?.[0]?.text || '';

    context.onStageChange?.('validating_signal');
    const tValidStart = performance.now();
    let resultSignal: MarketSignal;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      resultSignal = { ...parsed, timestamp: new Date() };
    } catch {
      const fallbackPrice = currentPrice ?? 0;
      resultSignal = {
        direction: 'NEUTRAL',
        confidence: 50,
        headline: 'Analysis unavailable — check API setup',
        summary: text.slice(0, 200),
        keyFactors: ['Data received', 'Parsing failed', 'Check console'],
        tradeIdea: 'Unable to generate trade idea at this time.',
        riskWarning: 'Always do your own research before trading.',
        entryZone: { low: fallbackPrice * 0.99, high: fallbackPrice * 1.01 },
        takeProfit: { price: fallbackPrice * 1.05, pct: 5, rationale: 'Default +5% target' },
        stopLoss:   { price: fallbackPrice * 0.97, pct: -3, rationale: 'Default -3% stop' },
        timestamp: new Date(),
      };
    }
    const validationMs = Math.round(performance.now() - tValidStart);
    const totalMs = Math.round(performance.now() - tStart) + sosoValueMs + marketDataMs;

    lastSignalTiming = {
      sosoValueMs,
      marketDataMs,
      dataProcessingMs,
      geminiApiMs,
      validationMs,
      totalMs,
    };
    console.info('[The Agent] Signal timing breakdown (ms):', lastSignalTiming);

    context.onStageChange?.('ready');

    if (hasRealData && resultSignal.headline !== 'Analysis unavailable — check API setup') {
      signalCache.set(cacheKey, { signal: resultSignal, ts: Date.now() });
    }
    return resultSignal;
  };

  if (!hasRealData) {
    return runAnalysis();
  }

  const promise = runAnalysis().finally(() => {
    inflightRequests.delete(cacheKey);
  });
  inflightRequests.set(cacheKey, promise);
  return promise;
}
