/**
 * Property-based tests — UI and context properties
 * Feature: etfsignal-hackathon
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import type { ReactNode } from 'react';
import { densityClasses } from '../utils/filters';
import type { Density } from '../contexts/DensityContext';
import { DensityProvider, useDensity } from '../contexts/DensityContext';
import { ConnectionStatusProvider } from '../contexts/ConnectionStatusContext';
import { DashboardProvider, useDashboard } from '../contexts/DashboardContext';
import { fetchEtfMetrics } from '../services/sosovalue';

// ─── Module-level mocks required by DashboardProvider ────────────────────────

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    primaryWallet: null,
    handleLogOut: vi.fn(),
    setShowAuthFlow: vi.fn(),
  }),
}));

vi.mock('@dynamic-labs/ethers-v6', () => ({
  getSigner: vi.fn().mockResolvedValue(null),
}));

vi.mock('../hooks/useLivePrices', () => ({
  useLivePrices: () => ({ BTC: null, ETH: null, connected: false }),
}));

vi.mock('../services/sosovalue', () => ({
  fetchEtfMetrics: vi.fn(),
  fetchNews: vi.fn().mockResolvedValue({ list: [], total: '0' }),
  fetchHistoricalInflows: vi.fn().mockResolvedValue([]),
  fetchPriceHistory: vi.fn().mockResolvedValue([]),
  fetchSignalHistory: vi.fn().mockResolvedValue([]),
  fetchAlerts: vi.fn().mockResolvedValue([]),
  getNewsTitle: vi.fn().mockReturnValue(''),
  formatUSD: vi.fn().mockReturnValue('—'),
  formatPct: vi.fn().mockReturnValue('—'),
}));

vi.mock('../services/alerts', () => ({
  deriveAlerts: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/ai', () => ({
  analyzeMarket: vi.fn(),
  buildPrompt: vi.fn().mockReturnValue(''),
  askFollowUp: vi.fn(),
}));

vi.mock('../services/sodex', () => ({
  placeSpotOrder: vi.fn(),
  truncateAddress: vi.fn((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`),
  connectWallet: vi.fn(),
}));

// ─── P18: Density mode class mapping ─────────────────────────────────────────
// Validates: Requirements 11.1

describe('P18: Density mode class mapping', () => {
  it('returns "gap-5 p-5" for comfortable, "gap-4 p-4" for compact, flex-col for mobile', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('comfortable', 'compact', 'mobile') as fc.Arbitrary<Density>,
        (density) => {
          const result = densityClasses(density);
          if (density === 'comfortable') return result === 'gap-5 p-5';
          if (density === 'compact') return result === 'gap-4 p-4';
          // mobile must indicate single-column layout
          if (density === 'mobile') return result.includes('flex-col');
          return false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('comfortable and compact return different class strings', () => {
    expect(densityClasses('comfortable')).not.toBe(densityClasses('compact'));
  });

  it('mobile class string includes flex-col for single-column layout', () => {
    expect(densityClasses('mobile')).toContain('flex-col');
  });
});

// ─── P19: Density mode localStorage persistence ───────────────────────────────
// Validates: Requirements 11.3

function DensityWrapper({ children }: { children: ReactNode }) {
  return <DensityProvider>{children}</DensityProvider>;
}

describe('P19: Density mode localStorage persistence', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('DensityProvider initializes with the stored density mode for any valid density', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('comfortable', 'compact', 'mobile') as fc.Arbitrary<Density>,
        (density) => {
          localStorage.setItem('etfsignal.density', density);

          let capturedDensity: Density | null = null;

          function Consumer() {
            const { density: d } = useDensity();
            capturedDensity = d as Density;
            return null;
          }

          const { unmount } = render(
            <DensityWrapper>
              <Consumer />
            </DensityWrapper>,
          );

          const result = capturedDensity === density;
          unmount();
          localStorage.clear();
          return result;
        },
      ),
      { numRuns: 3 },
    );
  });

  it('defaults to auto-detected density when localStorage is empty', () => {
    localStorage.removeItem('etfsignal.density');

    let capturedDensity: Density | null = null;

    function Consumer() {
      const { density: d } = useDensity();
      capturedDensity = d as Density;
      return null;
    }

    const { unmount } = render(
      <DensityWrapper>
        <Consumer />
      </DensityWrapper>,
    );

    const validDensities: Density[] = ['comfortable', 'compact', 'mobile'];
    expect(validDensities).toContain(capturedDensity);
    unmount();
  });
});

// ─── P20: No mock data on API error ──────────────────────────────────────────
// Validates: Requirements 12.2

function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ConnectionStatusProvider>
      <DashboardProvider>{children}</DashboardProvider>
    </ConnectionStatusProvider>
  );
}

describe('P20: No mock data on API error', () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Re-apply default mock for non-error functions after clearAllMocks
    vi.mocked(fetchEtfMetrics).mockRejectedValue(new Error('default mock reset'));
  });

  it('sets dataError to non-null and leaves btcData/ethData null for any error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMsg) => {
          vi.mocked(fetchEtfMetrics).mockRejectedValue(new Error(errorMsg));

          let ctx: ReturnType<typeof useDashboard> | null = null;

          function Consumer() {
            ctx = useDashboard();
            return null;
          }

          const { unmount } = render(
            <AppWrapper>
              <Consumer />
            </AppWrapper>,
          );

          // Wait for refresh() to complete (loading transitions false → true → false)
          await waitFor(
            () => {
              expect(ctx?.dataError).not.toBeNull();
            },
            { timeout: 3000 },
          );

          const snapshot = ctx!;
          const result =
            snapshot !== null &&
            snapshot.dataError !== null &&
            snapshot.btcData === null &&
            snapshot.ethData === null;

          unmount();
          return result;
        },
      ),
      { numRuns: 5 },
    );
  });
});
