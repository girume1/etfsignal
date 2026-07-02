import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../services/ai';
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

describe('buildPrompt context sections', () => {
  it('omits track record and flow sections when context is empty', () => {
    const prompt = buildPrompt('BTC', EMPTY_ETF_DATA, [], null);
    expect(prompt).not.toContain('Signal Track Record');
    expect(prompt).not.toContain('Extended Flow Context');
  });

  it('includes backtestSummary when provided', () => {
    const prompt = buildPrompt('BTC', EMPTY_ETF_DATA, [], null, {
      backtestSummary: { hitRate: 60, avgPnl: 2.5, sampleSize: 7 },
    });
    expect(prompt).toContain('Signal Track Record (last 7 real-evaluated signals)');
    expect(prompt).toContain('Hit Rate: 60%');
  });

  it('marks a missing flow window as unavailable rather than omitting the section', () => {
    const prompt = buildPrompt('BTC', EMPTY_ETF_DATA, [], null, { flow30dTotal: 1000 });
    expect(prompt).toContain('30-Day Net Flow');
    expect(prompt).toContain('90-Day Net Flow: unavailable');
  });
});
