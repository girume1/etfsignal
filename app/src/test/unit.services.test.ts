/**
 * Example-based unit tests — services
 * Feature: etfsignal-hackathon
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEtfMetrics, fetchNews } from '../services/sosovalue';
import { analyzeMarket, getLastSignalTiming } from '../services/ai';
import { placeSpotOrder, truncateAddress, validateOrderMinimum, SPOT_MIN_NOTIONAL_USD, PERPS_MIN_NOTIONAL_USD } from '../services/sodex';
import { handleTelegramLinkRequest, normalizeLinkCode, dualSet, codeKey } from '../../../api/telegram-link';
import { verifyAndLinkWallet, resolveTelegramUserName, buildStartMessage } from '../../../api/telegram';
import type { EtfData } from '../types';

const EMPTY_ETF_DATA: EtfData = {
  totalNetAssets: { value: null, lastUpdateDate: '' },
  totalNetAssetsPercentage: { value: null, lastUpdateDate: '' },
  totalTokenHoldings: { value: null, lastUpdateDate: '' },
  dailyNetInflow: { value: null, lastUpdateDate: '' },
  cumNetInflow: { value: null, lastUpdateDate: '' },
  dailyTotalValueTraded: { value: null, lastUpdateDate: '' },
  list: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 17.1: fetchEtfMetrics error path ─────────────────────────────────────────
// Validates: Requirements 1.4

describe('fetchEtfMetrics', () => {
  it('throws when the proxy returns a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    }));

    await expect(fetchEtfMetrics('us-btc-spot')).rejects.toThrow();
  });

  it('throws when the response has code !== 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 1, msg: 'ETF API error' }),
    }));

    await expect(fetchEtfMetrics('us-btc-spot')).rejects.toThrow('ETF API error');
  });

  it('returns EtfData when the response is valid (code === 0)', async () => {
    const mockData: EtfData = {
      totalNetAssets: { value: 1e9, lastUpdateDate: '2024-01-01' },
      totalNetAssetsPercentage: { value: 0.5, lastUpdateDate: '2024-01-01' },
      totalTokenHoldings: { value: 100, lastUpdateDate: '2024-01-01' },
      dailyNetInflow: { value: 1e6, lastUpdateDate: '2024-01-01' },
      cumNetInflow: { value: 1e8, lastUpdateDate: '2024-01-01' },
      dailyTotalValueTraded: { value: 5e6, lastUpdateDate: '2024-01-01' },
      list: [],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: mockData }),
    }));

    const result = await fetchEtfMetrics('us-btc-spot');
    expect(result).toEqual(mockData);
  });
});

describe('fetchNews', () => {
  it('normalizes raw SoSoValue news items and populates missing content/tags safely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        data: {
          list: [
            {
              id: 'news-101',
              category: 1,
              releaseTime: 1700000000000,
              author: 'SoSoValue Research',
              sourceLink: 'https://sosovalue.com/news/101',
              multilanguageContent: [
                { language: 'en', title: 'BTC ETF inflows surge' },
              ],
            },
          ],
          total: '1',
        },
      }),
    }));

    const res = await fetchNews({ pageNum: 1, pageSize: 10 });
    expect(res.total).toBe('1');
    expect(res.list).toHaveLength(1);
    expect(res.list[0].id).toBe('news-101');
    expect(res.list[0].tags).toEqual([]);
    expect(res.list[0].matchedCurrencies).toEqual([]);
    expect(res.list[0].multilanguageContent[0]).toEqual({
      language: 'en',
      title: 'BTC ETF inflows surge',
      content: '',
    });
  });
});

// ─── 17.2: AI parse failure fallback ──────────────────────────────────────────
// Validates: Requirements 3.4

describe('analyzeMarket', () => {
  it('returns NEUTRAL signal with confidence 50 when Gemini response is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: 'This is plain text, not JSON.' }] }),
    }));

    const result = await analyzeMarket('BTC', EMPTY_ETF_DATA, [], null);

    expect(result.direction).toBe('NEUTRAL');
    expect(result.confidence).toBe(50);
    expect(typeof result.headline).toBe('string');
    expect(result.headline.length).toBeGreaterThan(0);
  });

  it('returns all required MarketSignal fields when Gemini response is valid JSON', async () => {
    const mockSignal = {
      direction: 'BULLISH',
      confidence: 75,
      headline: 'Strong inflows signal bullish momentum',
      summary: 'BTC ETF inflows hit $500M, breaking 7-day streak.',
      keyFactors: ['IBIT leads with $300M', 'ETH rotation into BTC', 'Macro tailwinds'],
      tradeIdea: 'Long BTC on SoDEX above $95k.',
      riskWarning: 'Fed minutes may reverse momentum.',
      entryZone: { low: 94000, high: 96000 },
      takeProfit: { price: 102000, pct: 7.5, rationale: 'ATH resistance zone' },
      stopLoss: { price: 90000, pct: -4.2, rationale: 'Prior consolidation support' },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: JSON.stringify(mockSignal) }] }),
    }));

    const result = await analyzeMarket('BTC', EMPTY_ETF_DATA, [], null);

    expect(result.direction).toBe('BULLISH');
    expect(result.confidence).toBe(75);
    expect(result.headline).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.keyFactors)).toBe(true);
    expect(result.keyFactors.length).toBe(3);
    expect(result.tradeIdea).toBeDefined();
    expect(result.riskWarning).toBeDefined();
    expect(result.entryZone).toBeDefined();
    expect(result.takeProfit).toBeDefined();
    expect(result.stopLoss).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('returns NEUTRAL fallback when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(analyzeMarket('BTC', EMPTY_ETF_DATA, [], null)).rejects.toThrow('Network error');
  });
});

// ─── 17.3: placeSpotOrder payload structure ────────────────────────────────────
// Validates: Requirements 9.3

describe('placeSpotOrder', () => {
  const validSig = `0x${'11'.repeat(64)}1b`;

  const mockMarketsResponse = {
    ok: true,
    json: async () => ({
      code: 0,
      data: [
        { symbolID: 1, name: 'BTC-USDT', baseCoin: 'BTC', quoteCoin: 'USDT', pricePrecision: 2, quantityPrecision: 6 },
        { symbolID: 2, name: 'ETH-USDT', baseCoin: 'ETH', quoteCoin: 'USDT', pricePrecision: 2, quantityPrecision: 6 },
      ],
    }),
  };

  const mockAccountStateResponse = {
    ok: true,
    text: async () => JSON.stringify({ code: 0, data: { accountId: 1 } }),
    json: async () => ({ code: 0, data: { accountId: 1 } }),
  };

  it('sends symbolID=1 and side=1 for a BTC-USDT BUY order', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
      signTypedData: vi.fn().mockResolvedValue(validSig),
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/markets/symbols')) return Promise.resolve(mockMarketsResponse);
      if (url.includes('/accounts/')) return Promise.resolve(mockAccountStateResponse);
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      const payload = { code: 0, data: { orders: [{ ordId: 'order-btc-001' }] } };
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      });
    }));

    await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.01',
      currency: 'BTC',
    });

    expect(capturedBody).not.toBeNull();
    const orders = capturedBody!.orders as Array<{ symbolID: number; side: number }>;
    expect(orders[0].symbolID).toBe(1);
    expect(orders[0].side).toBe(1);
  });

  it('sends symbolID=2 and side=2 for an ETH-USDT SELL order', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
      signTypedData: vi.fn().mockResolvedValue(validSig),
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/markets/symbols')) return Promise.resolve(mockMarketsResponse);
      if (url.includes('/accounts/')) return Promise.resolve(mockAccountStateResponse);
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      const payload = { code: 0, data: { orders: [{ ordId: 'order-eth-001' }] } };
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      });
    }));

    await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'ETH-USDT',
      side: 'SELL',
      type: 'MARKET',
      quantity: '0.1',
      currency: 'ETH',
    });

    expect(capturedBody).not.toBeNull();
    const orders = capturedBody!.orders as Array<{ symbolID: number; side: number }>;
    expect(orders[0].symbolID).toBe(2);
    expect(orders[0].side).toBe(2);
  });

  it('returns success:false with error message when the API returns code !== 0', async () => {
    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
      signTypedData: vi.fn().mockResolvedValue(validSig),
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/markets/symbols')) return Promise.resolve(mockMarketsResponse);
      if (url.includes('/accounts/')) return Promise.resolve(mockAccountStateResponse);
      const errPayload = { code: 1, msg: 'Insufficient balance' };
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify(errPayload),
        json: async () => errPayload,
      });
    }));

    const result = await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '100',
      currency: 'BTC',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient balance');
  });
});

// ─── 17.4: truncateAddress ────────────────────────────────────────────────────
// Validates: Requirements 10.4

describe('truncateAddress', () => {
  it('returns {first6}...{last4} for a standard 42-char address', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateAddress(address)).toBe('0x1234...5678');
  });

  it('first 6 characters match the start of the address', () => {
    const address = '0xABCDEF1234567890abcdef1234567890abcdef12';
    const result = truncateAddress(address);
    expect(result.startsWith(address.slice(0, 6))).toBe(true);
  });

  it('last 4 characters match the end of the address', () => {
    const address = '0xABCDEF1234567890abcdef1234567890abcdef12';
    const result = truncateAddress(address);
    expect(result.endsWith(address.slice(-4))).toBe(true);
  });

  it('result has the form {6 chars}...{4 chars}', () => {
    const address = '0xabcdef1234567890abcdef1234567890abcdef12';
    const result = truncateAddress(address);
    expect(result).toMatch(/^.{6}\.\.\.(.{4})$/);
  });
});

// ─── 17.5: Minimum order validation (SoDEX $5 spot / $10 perps) ──────────────

describe('validateOrderMinimum', () => {
  it('rejects $1 spot orders because SoDEX enforces a $5 minNotional on spot', () => {
    const res = validateOrderMinimum({
      symbol: 'BTC-USDC',
      quantity: '1',
      currency: 'USDC',
      marketType: 'spot',
      referencePrice: 95000,
    });
    expect(res.valid).toBe(false);
    expect(res.minNotionalUsd).toBe(SPOT_MIN_NOTIONAL_USD);
    expect(res.error).toContain('$5');
  });

  it('accepts $5+ spot orders and $10+ futures orders', () => {
    const spotOk = validateOrderMinimum({
      symbol: 'BTC-USDC',
      quantity: '5',
      currency: 'USDC',
      marketType: 'spot',
      referencePrice: 95000,
    });
    expect(spotOk.valid).toBe(true);

    const perpsLow = validateOrderMinimum({
      symbol: 'BTC-USD',
      quantity: '5',
      currency: 'USDC',
      marketType: 'futures',
      referencePrice: 95000,
    });
    expect(perpsLow.valid).toBe(false);
    expect(perpsLow.minNotionalUsd).toBe(PERPS_MIN_NOTIONAL_USD);

    const perpsOk = validateOrderMinimum({
      symbol: 'BTC-USD',
      quantity: '10',
      currency: 'USDC',
      marketType: 'futures',
      referencePrice: 95000,
    });
    expect(perpsOk.valid).toBe(true);
  });

  it('enforces base-asset minQuantity and minNotional when referencePrice is provided', () => {
    const tooSmallQty = validateOrderMinimum({
      symbol: 'BTC-USDC',
      quantity: '0.000001',
      currency: 'BTC',
      marketType: 'spot',
    });
    expect(tooSmallQty.valid).toBe(false);

    const belowNotional = validateOrderMinimum({
      symbol: 'BTC-USDC',
      quantity: '0.00002',
      currency: 'BTC',
      marketType: 'spot',
      referencePrice: 90000, // $1.80 < $5
    });
    expect(belowNotional.valid).toBe(false);
    expect(belowNotional.error).toContain('$5');
  });
});

// ─── 17.6: End-to-End Dashboard ↔ Telegram Linking & /start Message ──────────

describe('Telegram Account Linking & /start Greeting', () => {
  it('normalizes valid ETF-XXXXXX codes (spaces, lowercase, /link prefix) and rejects invalid codes', () => {
    expect(normalizeLinkCode('  etf-ab23cd  ')).toBe('ETF-AB23CD');
    expect(normalizeLinkCode('/link ETF-9K4M2P')).toBe('ETF-9K4M2P');
    expect(normalizeLinkCode('`/link etf-7h8j9k`')).toBe('ETF-7H8J9K');
    expect(normalizeLinkCode('ETF-123')).toBeNull();
    expect(normalizeLinkCode('ABC-123456')).toBeNull();
    expect(normalizeLinkCode('')).toBeNull();
  });

  it('completes full dashboard → Telegram link → status check → single-use guard → unlink flow', async () => {
    const wallet = '0xAbCdEf1234567890abcdef1234567890AbCdEf12';
    const chatId = 987654321;

    // 1. Dashboard generates a link code
    const postReq = new Request('https://etfsignal.vercel.app/api/telegram-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: wallet }),
    });
    const postRes = await handleTelegramLinkRequest(postReq);
    expect(postRes.status).toBe(200);
    const { code, expiresIn } = await postRes.json() as { code: string; expiresIn: number };
    expect(code).toMatch(/^ETF-[A-Z0-9]{6}$/);
    expect(expiresIn).toBe(600);

    // 2. Before linking in Telegram, GET status is linked=false
    const statusBefore = await handleTelegramLinkRequest(
      new Request(`https://etfsignal.vercel.app/api/telegram-link?wallet=${wallet}`),
    );
    expect(await statusBefore.json()).toEqual({ linked: false });

    // 3. Telegram bot verifies the code (testing lowercase + extra spaces)
    const linkResult = await verifyAndLinkWallet(`  ${code.toLowerCase()}  `, chatId);
    expect(linkResult.ok).toBe(true);
    expect(linkResult.status).toBe('linked');
    expect(linkResult.message).toContain('Wallet Linked!');

    // 4. Dashboard GET status now reflects linked=true with chatId
    const statusAfter = await handleTelegramLinkRequest(
      new Request(`https://etfsignal.vercel.app/api/telegram-link?wallet=${wallet}`),
    );
    expect(await statusAfter.json()).toEqual({ linked: true, chatId: String(chatId) });

    // 5. Reusing the exact same code is rejected (single-use enforcement)
    const reuseResult = await verifyAndLinkWallet(code, chatId);
    expect(reuseResult.ok).toBe(false);
    expect(reuseResult.status).toBe('not_found');

    // 6. Dashboard DELETE unlinks the wallet
    const delRes = await handleTelegramLinkRequest(
      new Request(`https://etfsignal.vercel.app/api/telegram-link?wallet=${wallet}`, { method: 'DELETE' }),
    );
    expect(delRes.status).toBe(200);

    const statusUnlinked = await handleTelegramLinkRequest(
      new Request(`https://etfsignal.vercel.app/api/telegram-link?wallet=${wallet}`),
    );
    expect(await statusUnlinked.json()).toEqual({ linked: false });
  });

  it('returns expired status when a code is past its 10-minute expiration window', async () => {
    const expiredCode = 'ETF-EXP234';
    await dualSet(
      codeKey(expiredCode),
      JSON.stringify({
        walletAddress: '0x1111111111111111111111111111111111111111',
        expiresAt: Date.now() - 5000,
      }),
      300,
    );

    const res = await verifyAndLinkWallet(expiredCode, 12345);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('expired');
    expect(res.message).toContain('Code expired');
  });

  it('formats /start greeting with first_name, username fallback, and "there" fallback', () => {
    expect(resolveTelegramUserName({ first_name: 'Alice', username: 'alice_eth' })).toBe('Alice');
    expect(resolveTelegramUserName({ first_name: '  ', username: '@bob_trader' })).toBe('bob_trader');
    expect(resolveTelegramUserName({})).toBe('there');
    expect(resolveTelegramUserName(null)).toBe('there');

    const msg = buildStartMessage('Alice');
    expect(msg).toContain('Hi! Welcome to ETFSignalAI, Alice! 👋');
    expect(msg).toContain("I'm *The Agent*, ETFSignalAI's market intelligence assistant.");
    expect(msg).toContain('/signal or /btc');
    expect(msg).toContain('/link');
  });

  it('records end-to-end timing breakdown during analyzeMarket', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: '{"direction":"NEUTRAL","confidence":55,"headline":"Test","summary":"Test","keyFactors":["a","b","c"],"tradeIdea":"Hold","riskWarning":"None","entryZone":{"low":90000,"high":91000},"takeProfit":{"price":95000,"pct":5,"rationale":"TP"},"stopLoss":{"price":88000,"pct":-3,"rationale":"SL"}}' }] }),
    }));

    await analyzeMarket('BTC', EMPTY_ETF_DATA, [], 90500, { sosoValueMs: 12, marketDataMs: 1 });
    const timing = getLastSignalTiming();
    expect(timing).not.toBeNull();
    expect(timing!.sosoValueMs).toBe(12);
    expect(timing!.totalMs).toBeGreaterThanOrEqual(13);
  });
});
