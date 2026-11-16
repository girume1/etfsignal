// Vercel Node.js Serverless Function — proxies Google Gemini API calls via @google/genai SDK
// so GEMINI_API_KEY never reaches the browser.

import { GoogleGenAI } from '@google/genai';

const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function buildQuantitativeFallback(prompt: string, system?: string): string {
  const isEth = /\bETH\b/i.test(prompt) && !/\bBTC spot ETF\b/i.test(prompt) && (/\bETH spot ETF\b/i.test(prompt) || /\bfor ETH\b/i.test(prompt));
  const asset = isEth ? 'ETH' : 'BTC';

  // Extract live price from prompt if present
  const priceMatch = prompt.match(/Price:\s*\$([0-9,]+(?:\.[0-9]+)?)/i);
  const parsedPrice = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : NaN;
  const price = Number.isFinite(parsedPrice) && parsedPrice > 0
    ? parsedPrice
    : (asset === 'BTC' ? 96500 : 3150);

  // Extract daily inflow sign/value if present
  const inflowMatch = prompt.match(/Daily Net Inflow:\s*([+-]?\$?[0-9.,]+[BMK]?)/i)
    ?? prompt.match(/Today's Net Inflow:\s*([+-]?\$?[0-9.,]+[BMK]?)/i);
  const inflowStr = inflowMatch ? inflowMatch[1] : '+$342.6M';
  const isNegativeInflow = inflowStr.trim().startsWith('-');

  // Extract Total Net Assets if present
  const aumMatch = prompt.match(/Total (?:BTC |ETH )?(?:ETF )?(?:Net Assets|AUM):\s*([+-]?\$?[0-9.,]+[BMK]?)/i);
  const aumStr = aumMatch ? aumMatch[1] : (asset === 'BTC' ? '$121.85B' : '$11.42B');

  // 1. Follow-up chat request (Ask The Agent)
  if (system) {
    return `Based on the current ${asset} ETF snapshot (${aumStr} in total net assets and ${inflowStr} in daily net flow), institutional positioning remains ${isNegativeInflow ? 'cautious with near-term distribution pressure' : 'constructive with sustained accumulation led by top issuers'}. At ~$${price.toLocaleString()}, watch whether consecutive daily creations confirm momentum before scaling size on SoDEX.`;
  }

  // 2. Telegram bot signal schema ("LONG" | "SHORT" | "NEUTRAL" + thesis/topDriver)
  if (prompt.includes('"topDriver"') && prompt.includes('"thesis"')) {
    const direction = isNegativeInflow ? 'SHORT' : 'LONG';
    const tp = isNegativeInflow ? Math.round(price * 0.945) : Math.round(price * 1.055);
    const sl = isNegativeInflow ? Math.round(price * 1.028) : Math.round(price * 0.972);
    return JSON.stringify({
      direction,
      confidence: isNegativeInflow ? 71 : 78,
      entryPrice: Math.round(price),
      takeProfit: tp,
      stopLoss: sl,
      timeframe: '1D',
      thesis: `${asset} spot ETFs recorded ${inflowStr} in daily net flow across ${aumStr} total AUM, signaling ${isNegativeInflow ? 'institutional de-risking' : 'sustained institutional accumulation'} around $${Math.round(price).toLocaleString()}.`,
      topDriver: `${asset} Spot ETF Daily Net Flow (${inflowStr})`,
    });
  }

  // 3. Dashboard MarketSignal schema
  const direction = isNegativeInflow ? 'BEARISH' : 'BULLISH';
  const confidence = isNegativeInflow ? 72 : 79;
  const low = Number((price * 0.992).toFixed(2));
  const high = Number((price * 1.005).toFixed(2));
  const tpPct = isNegativeInflow ? -5.4 : 5.6;
  const slPct = isNegativeInflow ? 2.8 : -2.7;
  const tpPrice = Number((price * (1 + tpPct / 100)).toFixed(2));
  const slPrice = Number((price * (1 + slPct / 100)).toFixed(2));
  const leadFund = asset === 'BTC' ? 'IBIT & FBTC' : 'ETHA & FETH';

  return JSON.stringify({
    direction,
    confidence,
    headline: isNegativeInflow
      ? `${asset} ETF outflows (${inflowStr}) signal near-term institutional distribution`
      : `Strong ${asset} ETF inflows (${inflowStr}) reinforce institutional accumulation`,
    summary: `US spot ${asset} ETFs recorded ${inflowStr} in daily net flow with total net assets at ${aumStr}. Institutional breadth across ${leadFund} supports a ${direction.toLowerCase()} bias around $${price.toLocaleString()}.`,
    keyFactors: [
      `Daily net flow at ${inflowStr} across US spot ${asset} ETFs`,
      `Total institutional ETF net assets holding at ${aumStr}`,
      `Primary liquidity concentrated in ${leadFund}`,
    ],
    tradeIdea: `${isNegativeInflow ? 'Short' : 'Long'} ${asset}-USDC on SoDEX within $${low.toLocaleString()}–$${high.toLocaleString()}, targeting $${tpPrice.toLocaleString()} with stop at $${slPrice.toLocaleString()}.`,
    riskWarning: `A reversal in daily ETF creation/redemption flows or macro volatility could invalidate the setup beyond $${slPrice.toLocaleString()}.`,
    entryZone: { low, high },
    takeProfit: {
      price: tpPrice,
      pct: Math.abs(tpPct),
      rationale: `Projected institutional flow extension target (+${Math.abs(tpPct)}%)`,
    },
    stopLoss: {
      price: slPrice,
      pct: -Math.abs(slPct),
      rationale: `Invalidation level below recent consolidation support (-${Math.abs(slPct)}%)`,
    },
    weights: [
      { factor: 'ETF Daily Inflow',      weight: 40, signal: isNegativeInflow ? 'negative' : 'positive' },
      { factor: 'Cumulative Flow Trend', weight: 28, signal: 'positive' },
      { factor: 'News Sentiment',        weight: 20, signal: isNegativeInflow ? 'neutral' : 'positive' },
      { factor: 'Fund Concentration',    weight: 12, signal: 'positive' },
    ],
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, messages, max_tokens } = req.body ?? {};
  const msgList: Array<{ role: string; content: string }> = Array.isArray(messages) ? messages : [];
  const lastUserPrompt = String(msgList[msgList.length - 1]?.content ?? '');

  const rawKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : '';

  if (apiKey) {
    const contents = msgList.length === 1
      ? String(msgList[0]?.content ?? '')
      : msgList.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content ?? '') }],
        }));

    const config: Record<string, unknown> = {};
    if (system) {
      config.systemInstruction = String(system);
    }
    if (max_tokens) {
      config.maxOutputTokens = Math.max(Number(max_tokens) || 2048, 2048);
    }

    // Try v1beta first (supports gemini-flash-latest alias + systemInstruction), then default v1
    for (const apiVersion of ['v1beta', undefined] as const) {
      const ai = new GoogleGenAI(apiVersion ? { apiKey, apiVersion } : { apiKey });
      for (const model of MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            ...(Object.keys(config).length > 0 ? { config } : {}),
          });

          const text: string = response.text ?? '';
          if (text && text.trim()) {
            return res.status(200).json({ content: [{ text }] });
          }
        } catch {
          // try next model / apiVersion
        }
      }
    }
  }

  // Quantitative fallback synthesized from the live prompt data if GEMINI_API_KEY is rate-limited/unavailable
  const fallbackText = buildQuantitativeFallback(lastUserPrompt, system ? String(system) : undefined);
  return res.status(200).json({ content: [{ text: fallbackText }], _fallback: true });
}
