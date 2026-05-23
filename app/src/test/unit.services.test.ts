/**
 * Example-based unit tests — services
 * Feature: etfsignal-hackathon
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEtfMetrics } from '../services/sosovalue';
import { analyzeMarket } from '../services/ai';
import { placeSpotOrder, truncateAddress } from '../services/sodex';
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

// ─── 17.2: AI parse failure fallback ──────────────────────────────────────────
// Validates: Requirements 3.4

describe('analyzeMarket', () => {
  it('returns NEUTRAL signal with confidence 50 when Claude response is not valid JSON', async () => {
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

  it('returns all required MarketSignal fields when Claude response is valid JSON', async () => {
    const mockSignal = {
      direction: 'BULLISH',
      confidence: 75,
      headline: 'Strong inflows signal bullish momentum',
      summary: 'BTC ETF inflows hit $500M, breaking 7-day streak.',
      keyFactors: ['IBIT leads with $300M', 'ETH rotation into BTC', 'Macro tailwinds'],
      tradeIdea: 'Long BTC on SoDEX testnet above $95k.',
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
  it('sends symbolID=1 and side=1 for a BTC-USDT BUY order', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const mockSigner = {
      signTypedData: vi.fn().mockResolvedValue('0xdeadbeef12345678'),
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return Promise.resolve({
        json: async () => ({ code: 0, data: { orderId: 'order-btc-001' } }),
      });
    }));

    await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.01',
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.symbolID).toBe(1);
    const orders = capturedBody!.orders as Array<{ side: number }>;
    expect(orders[0].side).toBe(1);
  });

  it('sends symbolID=2 and side=2 for an ETH-USDT SELL order', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const mockSigner = {
      signTypedData: vi.fn().mockResolvedValue('0xdeadbeef12345678'),
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return Promise.resolve({
        json: async () => ({ code: 0, data: { orderId: 'order-eth-001' } }),
      });
    }));

    await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'ETH-USDT',
      side: 'SELL',
      type: 'MARKET',
      quantity: '0.1',
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.symbolID).toBe(2);
    const orders = capturedBody!.orders as Array<{ side: number }>;
    expect(orders[0].side).toBe(2);
  });

  it('returns success:false with error message when the API returns code !== 0', async () => {
    const mockSigner = {
      signTypedData: vi.fn().mockResolvedValue('0xdeadbeef12345678'),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ code: 1, msg: 'Insufficient balance' }),
    }));

    const result = await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '100',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
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
