import type { EtfData, NewsItem, MarketSignal } from '../types';
import { getNewsTitle, formatUSD } from './sosovalue';

function buildPrompt(
  etfType: 'BTC' | 'ETH',
  etfData: EtfData,
  news: NewsItem[]
): string {
  const inflow = etfData.dailyNetInflow.value;
  const cumInflow = etfData.cumNetInflow.value;
  const netAssets = etfData.totalNetAssets.value;
  const holdings = etfData.totalTokenHoldings.value;

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

  return `You are a professional crypto market analyst. Analyze the following ${etfType} spot ETF data and recent news, then produce a structured market signal.

## ${etfType} ETF Data (Today)
- Total Net Assets: ${formatUSD(netAssets)}
- Daily Net Inflow: ${formatUSD(inflow)}
- Cumulative Net Inflow: ${formatUSD(cumInflow)}
- Total ${etfType} Holdings: ${holdings?.toLocaleString() || '—'} ${etfType}

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
  "tradeIdea": "<specific, actionable suggestion, e.g. 'Consider a long BTC/USDT position on SoDEX testnet'>",
  "riskWarning": "<one sentence about the main risk to this thesis>"
}`;
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

  const systemContext = `You are the ETFSignal AI analyst assistant. You just produced this signal for ${etfType}:
${signal ? `Direction: ${signal.direction} · Confidence: ${signal.confidence}%
Headline: ${signal.headline}
Summary: ${signal.summary}` : 'No prior signal yet — answer from the data below.'}

Current data snapshot:
- Total net assets: ${netAssets}
- Daily net inflow: ${inflow}
- Top flows: ${topFlows}

Answer the user's question concisely (2-4 sentences max). Reference specific numbers. Do not repeat the summary verbatim. If the question is off-topic, politely steer back to ETF flows.`;

  const messages = [
    ...history.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: question },
  ];

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
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
  news: NewsItem[]
): Promise<MarketSignal> {
  const prompt = buildPrompt(etfType, etfData, news);

  // Calls our serverless function — NOT Anthropic directly
  // API key stays safe on the server
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { ...parsed, timestamp: new Date() };
  } catch {
    return {
      direction: 'NEUTRAL',
      confidence: 50,
      headline: 'Analysis unavailable — check API setup',
      summary: text.slice(0, 200),
      keyFactors: ['Data received', 'Parsing failed', 'Check console'],
      tradeIdea: 'Unable to generate trade idea at this time.',
      riskWarning: 'Always do your own research before trading.',
      timestamp: new Date(),
    };
  }
}
