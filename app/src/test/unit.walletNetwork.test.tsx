/**
 * Phase 3 tests: ValueChain config, connected-wallet network helper,
 * 4902 add+switch fallback, NotUnlocked handling, chainChanged reactivity,
 * and UI network pills / actionable TradeModal error recovery.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ensureWalletOnValueChain,
  isWalletLockedError,
  type DynamicWalletLike,
  type Eip1193Provider,
} from '../services/walletNetwork';
import { placeSpotOrder, ensureSoDEXNetwork } from '../services/sodex';
import {
  ACTIVE_VALUECHAIN,
  VALUECHAIN_MAINNET,
  VALUECHAIN_TESTNET,
  getAddEthereumChainParams,
  toDynamicEvmNetwork,
  getChainDisplayName,
} from '../config/valuechain';

// ─── 1. Single shared ValueChain config ────────────────────────────────────────

describe('ValueChain shared config', () => {
  it('defines exact Mainnet & Testnet chain IDs, currency, and explorer', () => {
    expect(VALUECHAIN_MAINNET.chainId).toBe(286623);
    expect(VALUECHAIN_MAINNET.chainIdHex).toBe('0x45F9F');
    expect(VALUECHAIN_MAINNET.name).toBe('ValueChain');
    expect(VALUECHAIN_MAINNET.nativeCurrency).toEqual({ name: 'SOSO', symbol: 'SOSO', decimals: 18 });
    expect(VALUECHAIN_MAINNET.explorerUrl).toBe('https://main-scan.valuechain.xyz');

    expect(VALUECHAIN_TESTNET.chainId).toBe(138565);
    expect(VALUECHAIN_TESTNET.chainIdHex).toBe('0x21D45');

    const dynamicNet = toDynamicEvmNetwork(VALUECHAIN_MAINNET);
    expect(dynamicNet.chainId).toBe(286623);
    expect(dynamicNet.networkId).toBe(286623);
    expect(dynamicNet.nativeCurrency.symbol).toBe('SOSO');
    expect(dynamicNet.rpcUrls).toEqual(['https://mainnet.valuechain.xyz']);
    expect(dynamicNet.blockExplorerUrls).toEqual(['https://main-scan.valuechain.xyz']);
  });
});

// ─── 2. Core network helper with mocked primaryWallet ──────────────────────────

describe('ensureWalletOnValueChain', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('already on chain = no-op', async () => {
    const providerRequest = vi.fn().mockResolvedValue(ACTIVE_VALUECHAIN.chainIdHex);
    const primaryWallet: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockResolvedValue(ACTIVE_VALUECHAIN.chainId),
      switchNetwork: vi.fn(),
      connector: {
        findProvider: () => ({ request: providerRequest }),
      },
    };

    const res = await ensureWalletOnValueChain({ primaryWallet });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('already_on_chain');
    expect(res.chainId).toBe(ACTIVE_VALUECHAIN.chainId);
    expect(primaryWallet.switchNetwork).not.toHaveBeenCalled();
    expect(providerRequest).toHaveBeenCalledTimes(1);
    expect(providerRequest).toHaveBeenCalledWith({ method: 'eth_chainId' });
  });

  it('4902 = add chain then switch using CONNECTED wallet provider (never global window.ethereum)', async () => {
    const windowTrap = vi.fn();
    vi.stubGlobal('window', {
      ethereum: { request: windowTrap },
    });

    const callOrder: string[] = [];
    const connectedProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        callOrder.push(method);
        if (method === 'eth_chainId') return '0x1'; // Ethereum Mainnet
        return null;
      }),
    };

    const err4902 = Object.assign(new Error('Unrecognized chain ID'), { code: 4902 });
    const primaryWallet: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockResolvedValue(1),
      switchNetwork: vi.fn().mockRejectedValue(err4902),
      connector: {
        findProvider: () => connectedProvider,
      },
    };

    const res = await ensureWalletOnValueChain({ primaryWallet });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('added_and_switched');
    expect(res.chainId).toBe(ACTIVE_VALUECHAIN.chainId);

    // Confirm connected wallet provider was used in exact order: add then switch
    expect(callOrder).toEqual([
      'eth_chainId',
      'wallet_addEthereumChain',
      'wallet_switchEthereumChain',
    ]);
    expect(connectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_addEthereumChain',
      params: [getAddEthereumChainParams(ACTIVE_VALUECHAIN)],
    });
    expect(connectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ACTIVE_VALUECHAIN.chainIdHex }],
    });
    // Global window.ethereum was completely untouched
    expect(windowTrap).not.toHaveBeenCalled();
  });

  it('provider-only path on 4902 adds chain then switches cleanly', async () => {
    const callOrder: string[] = [];
    let attempt = 0;
    const connectedProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        callOrder.push(method);
        if (method === 'eth_chainId') return '0x1';
        if (method === 'wallet_switchEthereumChain' && attempt === 0) {
          attempt += 1;
          throw Object.assign(new Error('Unrecognized chain'), { code: 4902 });
        }
        return null;
      }),
    };

    const res = await ensureWalletOnValueChain({ provider: connectedProvider });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('added_and_switched');
    expect(callOrder).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'wallet_switchEthereumChain',
    ]);
  });

  it('user rejects (code 4001) = handled error without throwing or falling through to add', async () => {
    const connectedRequest = vi.fn().mockResolvedValue('0x1');
    const primaryWallet: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockResolvedValue(1),
      switchNetwork: vi.fn().mockRejectedValue(
        Object.assign(new Error('User rejected the request.'), { code: 4001 }),
      ),
      connector: {
        findProvider: () => ({ request: connectedRequest }),
      },
    };

    const res = await ensureWalletOnValueChain({ primaryWallet });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('user_rejected');
    expect(res.error).toMatch(/cancelled|rejected/i);
    // Must not attempt wallet_addEthereumChain after user rejection
    expect(connectedRequest).toHaveBeenCalledTimes(1);
  });

  it('locked wallet (NotUnlocked) = friendly "Unlock your wallet" message and no uncaught console error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notUnlockedErr = Object.assign(new Error('NotUnlocked: MetaMask is locked'), {
      name: 'NotUnlocked',
    });

    expect(isWalletLockedError(notUnlockedErr)).toBe(true);

    const primaryWallet: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockRejectedValue(notUnlockedErr),
      switchNetwork: vi.fn(),
      connector: {
        findProvider: () => ({
          request: vi.fn().mockRejectedValue(notUnlockedErr),
        }),
      },
    };

    const res = await ensureWalletOnValueChain({ primaryWallet });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('locked');
    expect(res.error).toMatch(/Unlock your wallet/i);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Also verify ensureSoDEXNetwork throws WalletLockedError cleanly
    await expect(ensureSoDEXNetwork(true, { primaryWallet })).rejects.toThrow(/Unlock your wallet/i);
  });
});

// ─── 3. Pre-signing chain check in sodex.ts ───────────────────────────────────

describe('placeSpotOrder pre-signing network & lock verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('refuses EIP-712 signing when wallet stays on wrong chain and returns wrongNetwork flag', async () => {
    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
      signTypedData: vi.fn(),
      provider: {
        send: vi.fn(async (method: string) => {
          if (method === 'eth_chainId') return '0x1';
          if (method === 'wallet_switchEthereumChain') {
            throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
          }
          return null;
        }),
      },
    };

    const result = await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDC',
      side: 'BUY',
      type: 'MARKET',
      quantity: '10',
      currency: 'USDC',
    });

    expect(result.success).toBe(false);
    expect(result.wrongNetwork).toBe(true);
    expect(result.actualChainId).toBe(1);
    expect(mockSigner.signTypedData).not.toHaveBeenCalled();
  });

  it('returns walletLocked:true with friendly "Unlock your wallet" error when NotUnlocked occurs', async () => {
    const notUnlocked = Object.assign(new Error('NotUnlocked'), { name: 'NotUnlocked' });
    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
      signTypedData: vi.fn().mockRejectedValue(notUnlocked),
      provider: {
        send: vi.fn(async (method: string) => (method === 'eth_chainId' ? '0x1' : (() => { throw notUnlocked; })())),
      },
    };

    const result = await placeSpotOrder(mockSigner as never, 1, {
      symbol: 'BTC-USDC',
      side: 'BUY',
      type: 'MARKET',
      quantity: '10',
      currency: 'USDC',
    });

    expect(result.success).toBe(false);
    expect(result.walletLocked).toBe(true);
    expect(result.error).toMatch(/Unlock your wallet/i);
  });
});

// ─── 4. Header, TradePage, TradeModal & DashboardContext reactive chainChanged ─

const mockDynamicState: {
  primaryWallet: DynamicWalletLike | null;
  network: number | string | undefined;
} = {
  primaryWallet: null,
  network: undefined,
};

const mockGetSigner = vi.fn();

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    primaryWallet: mockDynamicState.primaryWallet,
    network: mockDynamicState.network,
    handleLogOut: vi.fn(),
    setShowAuthFlow: vi.fn(),
  }),
  mergeNetworks: (a: unknown[], b: unknown[]) => [...a, ...b],
}));

vi.mock('@dynamic-labs/ethers-v6', () => ({
  getSigner: (...args: unknown[]) => mockGetSigner(...args),
}));

vi.mock('../hooks/useLivePrices', () => ({
  useLivePrices: () => ({ BTC: 95_000, ETH: 3_200, connected: true }),
}));

vi.mock('../services/sosovalue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sosovalue')>();
  return {
    ...actual,
    fetchEtfMetrics: vi.fn().mockResolvedValue({
      totalNetAssets: { value: 1e9, lastUpdateDate: '2026-11-18' },
      totalNetAssetsPercentage: { value: 0.01, lastUpdateDate: '2026-11-18' },
      totalTokenHoldings: { value: 10_000, lastUpdateDate: '2026-11-18' },
      dailyNetInflow: { value: 5e7, lastUpdateDate: '2026-11-18' },
      cumNetInflow: { value: 1e9, lastUpdateDate: '2026-11-18' },
      dailyTotalValueTraded: { value: 2e8, lastUpdateDate: '2026-11-18' },
      list: [],
    }),
    fetchNews: vi.fn().mockResolvedValue({ list: [], total: '0' }),
    fetchHistoricalInflows: vi.fn().mockResolvedValue([]),
    fetchPriceHistory: vi.fn().mockResolvedValue([]),
    fetchSignalHistory: vi.fn().mockResolvedValue([]),
  };
});

import { ConnectionStatusProvider } from '../contexts/ConnectionStatusContext';
import { DashboardProvider } from '../contexts/DashboardContext';
import { useDashboard } from '../contexts/dashboardStore';
import { Header } from '../components/Header';
import { TradeModal } from '../components/TradeModal';
import TradePage from '../pages/app/TradePage';

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ConnectionStatusProvider>
        <DashboardProvider>{children}</DashboardProvider>
      </ConnectionStatusProvider>
    </MemoryRouter>
  );
}

describe('Phase 3 UI & DashboardContext chainChanged / NotUnlocked integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockDynamicState.primaryWallet = null;
    mockDynamicState.network = undefined;
    mockGetSigner.mockReset();
  });

  it('switches on connect, updates Header & TradePage on chainChanged, and switches via pill click', async () => {
    const listeners: Record<string, Array<(arg: unknown) => void>> = {};
    let currentHexChain = '0x1';

    const mockProvider: Eip1193Provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === 'eth_chainId') return currentHexChain;
        if (method === 'wallet_switchEthereumChain') {
          currentHexChain = ACTIVE_VALUECHAIN.chainIdHex;
          return null;
        }
        return null;
      }),
      on: (event, cb) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      },
      removeListener: (event, cb) => {
        listeners[event] = (listeners[event] || []).filter(fn => fn !== cb);
      },
    };

    const primaryWallet: DynamicWalletLike = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn(async () => Number.parseInt(currentHexChain, 16)),
      switchNetwork: vi.fn()
        // Reject initial auto-switch once so UI starts in wrong-network state, then succeed on click
        .mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }))
        .mockImplementationOnce(async () => {
          currentHexChain = ACTIVE_VALUECHAIN.chainIdHex;
        }),
      connector: {
        findProvider: () => mockProvider,
      },
    };

    mockDynamicState.primaryWallet = primaryWallet;
    mockDynamicState.network = 1;
    mockGetSigner.mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue(primaryWallet.address),
    });

    function Harness() {
      const { wallet, handleConnectWallet, handleDisconnectWallet, lastUpdated } = useDashboard();
      return (
        <>
          <Header
            wallet={wallet}
            onConnectWallet={handleConnectWallet}
            onDisconnectWallet={handleDisconnectWallet}
            lastUpdated={lastUpdated}
          />
          <TradePage />
        </>
      );
    }

    render(
      <TestWrapper>
        <Harness />
      </TestWrapper>,
    );

    // User rejected initial auto-switch: amber pill shows "Wrong network: Ethereum · Switch"
    // and TradePage "Network" card shows REAL connected chain Ethereum / 1
    expect(await screen.findByText(/Wrong network: Ethereum · Switch/)).toBeInTheDocument();
    expect(screen.getByTestId('trade-connected-network')).toHaveTextContent(getChainDisplayName(1));
    expect(screen.getByTestId('trade-connected-chain-id')).toHaveTextContent('1');

    // Buy/Sell stay ENABLED when wallet can auto-switch
    expect(screen.getByRole('button', { name: /buy btc/i })).not.toBeDisabled();

    // Clicking the amber header pill calls switchToValueChain and flips to green ValueChain pill
    fireEvent.click(screen.getByText(/Wrong network: Ethereum · Switch/));
    expect(await screen.findByText(`${ACTIVE_VALUECHAIN.name} · ${ACTIVE_VALUECHAIN.chainId}`)).toBeInTheDocument();
    expect(screen.getByTestId('trade-connected-network')).toHaveTextContent(ACTIVE_VALUECHAIN.name);
    expect(screen.getByTestId('trade-connected-chain-id')).toHaveTextContent(String(ACTIVE_VALUECHAIN.chainId));

    // Simulate external wallet chainChanged back to Ethereum (0x1)
    await act(async () => {
      currentHexChain = '0x1';
      (listeners.chainChanged || []).forEach(fn => fn('0x1'));
    });

    expect(await screen.findByText(/Wrong network: Ethereum · Switch/)).toBeInTheDocument();
    expect(screen.getByTestId('trade-connected-network')).toHaveTextContent('Ethereum');
    expect(screen.getByTestId('trade-connected-chain-id')).toHaveTextContent('1');
  });

  it('handles NotUnlocked error from getSigner cleanly without uncaught console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notUnlocked = Object.assign(new Error('NotUnlocked'), { name: 'NotUnlocked' });

    mockDynamicState.primaryWallet = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockRejectedValue(notUnlocked),
      switchNetwork: vi.fn(),
    };
    mockGetSigner.mockRejectedValue(notUnlocked);

    function Harness() {
      const { wallet, handleConnectWallet, handleDisconnectWallet, lastUpdated } = useDashboard();
      return (
        <>
          <Header
            wallet={wallet}
            onConnectWallet={handleConnectWallet}
            onDisconnectWallet={handleDisconnectWallet}
            lastUpdated={lastUpdated}
          />
          <TradePage />
        </>
      );
    }

    render(
      <TestWrapper>
        <Harness />
      </TestWrapper>,
    );

    expect(await screen.findAllByText(/Unlock your wallet/i)).not.toHaveLength(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('disables Buy/Sell only when wrong network cannot auto-switch, with clear manual message', async () => {
    const unsupportedErr = Object.assign(
      new Error('wallet_switchEthereumChain not implemented'),
      { code: 4200 },
    );

    mockDynamicState.primaryWallet = {
      address: '0x1111222233334444555566667777888899990000',
      getNetwork: vi.fn().mockResolvedValue(1),
      switchNetwork: vi.fn().mockRejectedValue(unsupportedErr),
      connector: {
        switchNetworkOnlyFromWallet: true,
        findProvider: () => ({
          request: vi.fn(async ({ method }: { method: string }) => {
            if (method === 'eth_chainId') return '0x1';
            throw unsupportedErr;
          }),
        }),
      },
    };
    mockDynamicState.network = 1;
    mockGetSigner.mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0x1111222233334444555566667777888899990000'),
    });

    render(
      <TestWrapper>
        <TradePage />
      </TestWrapper>,
    );

    expect(
      await screen.findByText(new RegExp(`Buy / Sell disabled — switch to ${ACTIVE_VALUECHAIN.name}`, 'i')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy btc/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /sell btc/i })).toBeDisabled();
    expect(screen.getAllByText(new RegExp(ACTIVE_VALUECHAIN.rpcUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).length).toBeGreaterThan(0);
  });

  it('TradeModal shows actionable "Switch to ValueChain" button when order fails with wrongNetwork', async () => {
    const onSwitchNetwork = vi.fn().mockResolvedValue(true);
    const wrongNetErr = Object.assign(
      new Error('Wrong network (Ethereum). Switch to ValueChain (286623) before signing.'),
      { wrongNetwork: true },
    );
    const onConfirm = vi.fn().mockRejectedValue(wrongNetErr);

    render(
      <TradeModal
        signal={null}
        side="BUY"
        symbol="BTC-USDC"
        walletChainId={1}
        currentPrice={95_000}
        onSwitchNetwork={onSwitchNetwork}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /^buy 10 usdc$/i }));

    expect(await screen.findByText('Order Failed')).toBeInTheDocument();
    const switchButtons = screen.getAllByRole('button', { name: new RegExp(`Switch to ${ACTIVE_VALUECHAIN.name}`, 'i') });
    expect(switchButtons.length).toBeGreaterThan(0);

    fireEvent.click(switchButtons[0]);
    await waitFor(() => {
      expect(onSwitchNetwork).toHaveBeenCalledOnce();
    });
  });
});
