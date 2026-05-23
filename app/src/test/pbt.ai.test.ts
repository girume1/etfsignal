/**
 * Property-based tests — AI and address properties
 * Feature: etfsignal-hackathon
 */

import { describe, it, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { EtfData, NewsItem } from '../types';
import { buildPrompt } from '../services/ai';
import { truncateAddress } from '../services/sodex';

// ─── Shared arbitraries ───────────────────────────────────────────────────

/** Arbitrary for an EtfMetric with a nullable value. */
const etfMetricArb = fc.record({
  value: fc.oneof(fc.constant(null), fc.float({ noNaN: true })),
  lastUpdateDate: fc.string(),
});

/** Arbitrary for a single EtfFund. */
const etfFundArb = fc.record({
  id: fc.string({ minLength: 1 }),
  ticker: fc.string({ minLength: 1, maxLength: 10 }),
  institute: fc.string({ minLength: 1 }),
  netAssets: etfMetricArb,
  netAssetsPercentage: etfMetricArb,
  dailyNetInflow: etfMetricArb,
  cumNetInflow: etfMetricArb,
  dailyValueTraded: etfMetricArb,
  fee: etfMetricArb,
  discountPremiumRate: etfMetricArb,
});

/** Arbitrary for a full EtfData object. */
const etfDataArb: fc.Arbitrary<EtfData> = fc.record({
  totalNetAssets: etfMetricArb,
  totalNetAssetsPercentage: etfMetricArb,
  totalTokenHoldings: etfMetricArb,
  dailyNetInflow: etfMetricArb,
  cumNetInflow: etfMetricArb,
  dailyTotalValueTraded: etfMetricArb,
  list: fc.array(etfFundArb, { maxLength: 30 }),
});

/** Arbitrary for a single multilanguageContent entry. */
const multilanguageContentArb = fc
  .tuple(
    fc.record({
      language: fc.constant('en'),
      title: fc.string(),
      content: fc.string(),
    }),
    fc.array(
      fc.record({
        language: fc.string({ minLength: 2, maxLength: 5 }),
        title: fc.string(),
        content: fc.string(),
      }),
      { maxLength: 3 },
    ),
  )
  .map(([enEntry, extras]) => [enEntry, ...extras]);

/** Arbitrary for a full NewsItem. */
const newsItemArb: fc.Arbitrary<NewsItem> = fc.record({
  id: fc.string({ minLength: 1 }),
  sourceLink: fc.string(),
  releaseTime: fc.integer({ min: 0 }),
  author: fc.string(),
  category: fc.integer({ min: 0, max: 10 }),
  featureImage: fc.string(),
  matchedCurrencies: fc.array(
    fc.record({
      id: fc.string(),
      fullName: fc.string(),
      name: fc.string(),
    }),
  ),
  tags: fc.array(fc.string()),
  multilanguageContent: multilanguageContentArb,
});

// ─── P4: AI prompt respects data limits ──────────────────────────────────
// Validates: Requirements 3.1

describe('P4: AI prompt respects data limits', () => {
  it('includes at most 5 fund entries and at most 8 news headlines for any input', () => {
    fc.assert(
      fc.property(
        fc.record({
          etfData: etfDataArb,
          news: fc.array(newsItemArb, { maxLength: 50 }),
        }),
        ({ etfData, news }) => {
          const prompt = buildPrompt('BTC', etfData, news, null);

          // Count fund lines: each fund entry is formatted as "  - TICKER (Institute): ..."
          // We count lines that start with "  - " inside the "## Top Fund Flows" section.
          // A reliable approach: split on the section header and count bullet lines.
          const topFundsSection = prompt.split('## Top Fund Flows')[1]?.split('\n## ')[0] ?? '';
          const fundLines = topFundsSection
            .split('\n')
            .filter(line => line.trim().startsWith('-'));

          // Count news lines: each news entry is formatted as "  - [category] title"
          const newsSection = prompt.split('## Recent News Headlines')[1]?.split('\n## ')[0] ?? '';
          const newsLines = newsSection
            .split('\n')
            .filter(line => line.trim().startsWith('-'));

          return fundLines.length <= 5 && newsLines.length <= 8;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fund count equals min(5, funds with non-null inflow)', () => {
    fc.assert(
      fc.property(
        fc.record({
          etfData: etfDataArb,
          news: fc.array(newsItemArb, { maxLength: 50 }),
        }),
        ({ etfData, news }) => {
          const prompt = buildPrompt('ETH', etfData, news, null);

          const topFundsSection = prompt.split('## Top Fund Flows')[1]?.split('\n## ')[0] ?? '';
          const fundLines = topFundsSection
            .split('\n')
            .filter(line => line.trim().startsWith('-'));

          const fundsWithInflow = etfData.list.filter(
            f => f.dailyNetInflow.value !== null,
          ).length;

          const expectedFundCount = Math.min(5, fundsWithInflow);
          return fundLines.length === expectedFundCount;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('news count equals min(8, news.length)', () => {
    fc.assert(
      fc.property(
        fc.record({
          etfData: etfDataArb,
          news: fc.array(newsItemArb, { maxLength: 50 }),
        }),
        ({ etfData, news }) => {
          const prompt = buildPrompt('BTC', etfData, news, null);

          const newsSection = prompt.split('## Recent News Headlines')[1]?.split('\n## ')[0] ?? '';
          const newsLines = newsSection
            .split('\n')
            .filter(line => line.trim().startsWith('-'));

          const expectedNewsCount = Math.min(8, news.length);
          return newsLines.length === expectedNewsCount;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── P7: AskAI conversation history truncation ───────────────────────────
// Validates: Requirements 4.2

describe('P7: AskAI conversation history truncation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends at most 10 prior turns regardless of history length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
            content: fc.string(),
          }),
          { maxLength: 50 },
        ),
        async (history) => {
          // Capture the request body sent to fetch
          let capturedBody: { messages?: unknown[] } | null = null;

          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: [{ text: 'test response' }] }),
          });
          vi.stubGlobal('fetch', mockFetch);

          // Dynamically import to get the current module state
          const { askFollowUp } = await import('../services/ai');

          const etfData: EtfData = {
            totalNetAssets: { value: 1e9, lastUpdateDate: '2024-01-01' },
            totalNetAssetsPercentage: { value: 0.5, lastUpdateDate: '2024-01-01' },
            totalTokenHoldings: { value: 100, lastUpdateDate: '2024-01-01' },
            dailyNetInflow: { value: 1e6, lastUpdateDate: '2024-01-01' },
            cumNetInflow: { value: 1e8, lastUpdateDate: '2024-01-01' },
            dailyTotalValueTraded: { value: 5e6, lastUpdateDate: '2024-01-01' },
            list: [],
          };

          await askFollowUp('BTC', etfData, null, history, 'test question');

          // Extract the messages array from the captured fetch call
          const callArgs = mockFetch.mock.calls[0];
          const requestInit = callArgs[1] as RequestInit;
          capturedBody = JSON.parse(requestInit.body as string);

          const sentMessages = capturedBody?.messages ?? [];

          // The messages array contains prior turns + the new user question.
          // Prior turns = sentMessages.length - 1 (the last one is the new question).
          const priorTurns = sentMessages.length - 1;

          return priorTurns <= 10;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('always includes the new user question as the last message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
            content: fc.string(),
          }),
          { maxLength: 50 },
        ),
        fc.string({ minLength: 1 }),
        async (history, question) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: [{ text: 'test response' }] }),
          });
          vi.stubGlobal('fetch', mockFetch);

          const { askFollowUp } = await import('../services/ai');

          const etfData: EtfData = {
            totalNetAssets: { value: 1e9, lastUpdateDate: '2024-01-01' },
            totalNetAssetsPercentage: { value: 0.5, lastUpdateDate: '2024-01-01' },
            totalTokenHoldings: { value: 100, lastUpdateDate: '2024-01-01' },
            dailyNetInflow: { value: 1e6, lastUpdateDate: '2024-01-01' },
            cumNetInflow: { value: 1e8, lastUpdateDate: '2024-01-01' },
            dailyTotalValueTraded: { value: 5e6, lastUpdateDate: '2024-01-01' },
            list: [],
          };

          await askFollowUp('BTC', etfData, null, history, question);

          const callArgs = mockFetch.mock.calls[0];
          const requestInit = callArgs[1] as RequestInit;
          const capturedBody = JSON.parse(requestInit.body as string) as { messages?: Array<{ role: string; content: string }> };
          const sentMessages = capturedBody?.messages ?? [];

          const lastMessage = sentMessages[sentMessages.length - 1];
          return lastMessage?.role === 'user' && lastMessage?.content === question;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── P17: Wallet address truncation ──────────────────────────────────────
// Validates: Requirements 10.4

describe('P17: Wallet address truncation', () => {
  it('returns {first6}...{last4} for any valid Ethereum address', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'),
          { minLength: 40, maxLength: 40 },
        ).map(chars => '0x' + chars.join('')),
        (address) => {
          const result = truncateAddress(address);
          const expected = `${address.slice(0, 6)}...${address.slice(-4)}`;
          return result === expected;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result always has the form {6 chars}...{4 chars}', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'),
          { minLength: 40, maxLength: 40 },
        ).map(chars => '0x' + chars.join('')),
        (address) => {
          const result = truncateAddress(address);
          // Must match pattern: exactly 6 chars, then "...", then exactly 4 chars
          return /^.{6}\.\.\.(.{4})$/.test(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('first 6 chars of result match first 6 chars of address', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'),
          { minLength: 40, maxLength: 40 },
        ).map(chars => '0x' + chars.join('')),
        (address) => {
          const result = truncateAddress(address);
          return result.startsWith(address.slice(0, 6));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('last 4 chars of result match last 4 chars of address', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'),
          { minLength: 40, maxLength: 40 },
        ).map(chars => '0x' + chars.join('')),
        (address) => {
          const result = truncateAddress(address);
          return result.endsWith(address.slice(-4));
        },
      ),
      { numRuns: 100 },
    );
  });
});
