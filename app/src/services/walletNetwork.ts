import type { Signer } from 'ethers';
import {
  ACTIVE_VALUECHAIN,
  getAddEthereumChainParams,
  getChainDisplayName,
  parseChainIdValue,
  type ValueChainNetworkConfig,
} from '../config/valuechain';

export const WALLET_LOCKED_MESSAGE =
  'Unlock your wallet to connect to ValueChain and sign orders.';

export type ProviderEventListener = {
  bivarianceHack(...args: unknown[]): void;
}['bivarianceHack'];

export interface WalletClientLike {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: ProviderEventListener) => void;
  removeListener?: (event: string, listener: ProviderEventListener) => void;
  transport?: {
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
}

interface SignerWithProvider {
  provider?: {
    send?: (method: string, params: unknown[]) => Promise<unknown>;
    getNetwork?: () => Promise<{ chainId?: number | bigint }>;
  };
}

function getUnknownErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return err != null ? String(err) : fallback;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: ProviderEventListener) => void;
  removeListener?: (event: string, listener: ProviderEventListener) => void;
}

export interface DynamicWalletLike {
  address?: string;
  chain?: string;
  getNetwork: () => Promise<number | string | undefined>;
  switchNetwork: (chainId: number | string) => Promise<void>;
  getWalletClient?: () => Promise<WalletClientLike | undefined>;
  connector?: {
    key?: string;
    name?: string;
    switchNetworkOnlyFromWallet?: boolean;
    findProvider?: () => Eip1193Provider | undefined;
    coinbaseProvider?: Eip1193Provider;
    getNetwork?: (returnDynamicNetworkId?: boolean) => Promise<number | string | undefined>;
    getWalletClient?: () => Promise<WalletClientLike | undefined> | WalletClientLike;
    on?: (event: string, listener: ProviderEventListener) => void;
    off?: (event: string, listener: ProviderEventListener) => void;
    removeListener?: (event: string, listener: ProviderEventListener) => void;
  };
}

export type EnsureNetworkStatus =
  | 'already_on_chain'
  | 'switched'
  | 'added_and_switched'
  | 'user_rejected'
  | 'locked'
  | 'manual_switch_required'
  | 'no_provider'
  | 'failed';

export interface EnsureNetworkResult {
  ok: boolean;
  status: EnsureNetworkStatus;
  chainId: number | null;
  targetChainId: number;
  chainName: string | null;
  canAutoSwitch: boolean;
  error?: string;
}

export interface WalletChainInfo {
  chainId: number | null;
  chainName: string | null;
  locked: boolean;
  error?: string;
  provider: Eip1193Provider | null;
}

export class WrongNetworkError extends Error {
  readonly code = 'WRONG_NETWORK';
  readonly actualChainId: number | null;
  readonly targetChainId: number;
  readonly canAutoSwitch: boolean;

  constructor(
    message: string,
    actualChainId: number | null = null,
    targetChainId: number = ACTIVE_VALUECHAIN.chainId,
    canAutoSwitch = true,
  ) {
    super(message);
    this.name = 'WrongNetworkError';
    this.actualChainId = actualChainId;
    this.targetChainId = targetChainId;
    this.canAutoSwitch = canAutoSwitch;
  }
}

export class WalletLockedError extends Error {
  readonly code = 'WALLET_LOCKED';

  constructor(message: string = WALLET_LOCKED_MESSAGE) {
    super(message);
    this.name = 'WalletLockedError';
  }
}

function collectErrorSignals(err: unknown): {
  names: string[];
  codes: Array<string | number>;
  messages: string[];
} {
  const names: string[] = [];
  const codes: Array<string | number> = [];
  const messages: string[] = [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [err];

  while (queue.length > 0 && visited.size < 12) {
    const cur = queue.shift();
    if (cur == null || visited.has(cur)) continue;
    visited.add(cur);

    if (typeof cur === 'string') {
      messages.push(cur);
      continue;
    }
    if (typeof cur !== 'object') continue;

    const obj = cur as Record<string, unknown>;
    if (typeof obj.name === 'string') names.push(obj.name);
    if (typeof obj.code === 'string' || typeof obj.code === 'number') codes.push(obj.code);
    if (typeof obj.message === 'string') messages.push(obj.message);
    if (typeof obj.details === 'string') messages.push(obj.details);
    if (typeof obj.shortMessage === 'string') messages.push(obj.shortMessage);

    for (const key of ['cause', 'error', 'data', 'originalError', 'orginalError', 'info']) {
      if (obj[key] !== undefined && obj[key] !== null) {
        queue.push(obj[key]);
      }
    }
  }

  return { names, codes, messages };
}

/** Detect locked wallet errors (NotUnlocked, WALLET_LOCKED, EIP-1193 4100, etc.). */
export function isWalletLockedError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof WalletLockedError) return true;
  const { names, codes, messages } = collectErrorSignals(err);

  if (names.some(n => /notunlocked|walletlocked/i.test(n))) return true;
  if (codes.some(c => c === 4100 || String(c).toUpperCase() === 'WALLET_LOCKED' || String(c) === 'NotUnlocked')) {
    return true;
  }
  const combined = messages.join(' ');
  return /\bnotunlocked\b|wallet\s*(is\s*)?locked|unlock\s*(your\s*)?wallet|extension\s*(is\s*)?locked|wallet_locked/i.test(combined);
}

/** Detect EIP-1193 4001 / user-cancelled signature or network switch errors. */
export function isUserRejectedError(err: unknown): boolean {
  if (!err) return false;
  const { names, codes, messages } = collectErrorSignals(err);
  if (names.some(n => /UserRejectedRequestError/i.test(n))) return true;
  if (codes.some(c => c === 4001 || c === 'ACTION_REJECTED')) return true;
  const combined = messages.join(' ');
  return /user\s+rejected|rejected\s+the\s+request|user\s+denied|request\s+rejected|user\s+cancelled|ethers-user-denied/i.test(combined);
}

/** Detect EIP-1193 4902 / unknown chain errors requiring `wallet_addEthereumChain`. */
export function isUnrecognizedChainError(err: unknown): boolean {
  if (!err) return false;
  const { codes, messages } = collectErrorSignals(err);
  if (codes.some(c => c === 4902)) return true;
  const combined = messages.join(' ');
  return /unrecognized\s+chain|unknown\s+chain|no\s+chain\s+configuration\s+found|\b4902\b|chain.*has\s+not\s+been\s+added/i.test(combined);
}

/** Detect wallets that prohibit programmatic chain switching (WalletConnect v1 / read-only). */
export function isUnsupportedSwitchMethodError(err: unknown): boolean {
  if (!err) return false;
  const { codes, messages } = collectErrorSignals(err);
  if (codes.some(c => c === 4200)) return true;
  const combined = messages.join(' ');
  return /wallet_switchethereumchain.*not\s+implemented|network\s+switching\s+is\s+not\s+(available|supported)|does\s+not\s+support\s+(programmatic\s+)?(network|chain)\s+switch|switch\s+network\s+manually/i.test(combined);
}

function adaptWalletClient(client: WalletClientLike | null | undefined): Eip1193Provider | null {
  if (!client) return null;
  if (typeof client.request === 'function') {
    const req = client.request.bind(client);
    return {
      request: (args) => req(args),
      on: typeof client.on === 'function' ? client.on.bind(client) : undefined,
      removeListener: typeof client.removeListener === 'function' ? client.removeListener.bind(client) : undefined,
    };
  }
  if (client.transport && typeof client.transport.request === 'function') {
    const transportReq = client.transport.request.bind(client.transport);
    return {
      request: (args) => transportReq(args),
    };
  }
  return null;
}

/**
 * Resolve the connected wallet's own EIP-1193 provider instead of blindly
 * reading global `window.ethereum` (which breaks when multiple wallet extensions
 * such as OKX, MetaMask, and Rabby are installed).
 */
export async function resolveConnectedProvider(options: {
  primaryWallet?: DynamicWalletLike | null;
  signer?: Signer | null;
  provider?: Eip1193Provider | null;
  allowLegacyWindowFallback?: boolean;
} = {}): Promise<Eip1193Provider | null> {
  const { primaryWallet, signer, provider, allowLegacyWindowFallback = false } = options;

  if (provider && typeof provider.request === 'function') {
    return provider;
  }

  if (primaryWallet) {
    const connector = primaryWallet.connector;

    // 1. Dynamic connector's matched EIP-6963 / extension provider (does NOT pick wrong extension)
    try {
      const found = connector?.findProvider?.();
      if (found && typeof found.request === 'function') {
        return found;
      }
    } catch (err) {
      if (isWalletLockedError(err)) throw new WalletLockedError();
    }

    // 2. Coinbase connector provider
    if (connector?.coinbaseProvider && typeof connector.coinbaseProvider.request === 'function') {
      return connector.coinbaseProvider;
    }

    // 3. Dynamic EthereumWallet / WalletConnect viem WalletClient
    try {
      const client = (await primaryWallet.getWalletClient?.()) ?? (await connector?.getWalletClient?.());
      const adapted = adaptWalletClient(client);
      if (adapted) return adapted;
    } catch (err) {
      if (isWalletLockedError(err)) throw new WalletLockedError();
    }
  }

  // 4. Connected signer's BrowserProvider (backed by Dynamic's walletClient.transport)
  const signerProvider = (signer as unknown as SignerWithProvider | null | undefined)?.provider;
  if (signerProvider && typeof signerProvider.send === 'function') {
    const sendFn = signerProvider.send.bind(signerProvider);
    return {
      request: ({ method, params }) => sendFn(method, params ?? []),
    };
  }

  // 5. Strict last-resort legacy path only for non-Dynamic direct calls
  if (allowLegacyWindowFallback && typeof window !== 'undefined' && window.ethereum?.request) {
    return window.ethereum as Eip1193Provider;
  }

  return null;
}

/** Read the wallet's actual current chain ID without throwing on locked wallets. */
export async function getWalletChainId(options: {
  primaryWallet?: DynamicWalletLike | null;
  signer?: Signer | null;
  provider?: Eip1193Provider | null;
  allowLegacyWindowFallback?: boolean;
} = {}): Promise<WalletChainInfo> {
  let walletProvider: Eip1193Provider | null = null;
  try {
    walletProvider = await resolveConnectedProvider(options);
  } catch (err) {
    if (isWalletLockedError(err)) {
      return {
        chainId: null,
        chainName: null,
        locked: true,
        error: WALLET_LOCKED_MESSAGE,
        provider: null,
      };
    }
  }

  if (walletProvider) {
    try {
      const rawChain = await walletProvider.request({ method: 'eth_chainId' });
      const parsed = parseChainIdValue(rawChain);
      if (parsed !== null) {
        return {
          chainId: parsed,
          chainName: getChainDisplayName(parsed),
          locked: false,
          provider: walletProvider,
        };
      }
    } catch (err) {
      if (isWalletLockedError(err)) {
        return {
          chainId: null,
          chainName: null,
          locked: true,
          error: WALLET_LOCKED_MESSAGE,
          provider: walletProvider,
        };
      }
    }
  }

  if (options.primaryWallet) {
    try {
      const raw =
        (await options.primaryWallet.getNetwork?.()) ??
        (await options.primaryWallet.connector?.getNetwork?.(true));
      const parsed = parseChainIdValue(raw);
      if (parsed !== null) {
        return {
          chainId: parsed,
          chainName: getChainDisplayName(parsed),
          locked: false,
          provider: walletProvider,
        };
      }
    } catch (err) {
      if (isWalletLockedError(err)) {
        return {
          chainId: null,
          chainName: null,
          locked: true,
          error: WALLET_LOCKED_MESSAGE,
          provider: walletProvider,
        };
      }
    }
  }

  const signerProvider = (options.signer as unknown as SignerWithProvider | null | undefined)?.provider;
  if (signerProvider && typeof signerProvider.getNetwork === 'function') {
    try {
      const net = await signerProvider.getNetwork();
      const parsed = parseChainIdValue(Number(net?.chainId));
      if (parsed !== null) {
        return {
          chainId: parsed,
          chainName: getChainDisplayName(parsed),
          locked: false,
          provider: walletProvider,
        };
      }
    } catch (err) {
      if (isWalletLockedError(err)) {
        return {
          chainId: null,
          chainName: null,
          locked: true,
          error: WALLET_LOCKED_MESSAGE,
          provider: walletProvider,
        };
      }
    }
  }

  return {
    chainId: null,
    chainName: null,
    locked: false,
    provider: walletProvider,
  };
}

function manualSwitchMessage(config: ValueChainNetworkConfig): string {
  return `Automatic network switching is unavailable in this wallet. Switch manually to ${config.name} (Chain ID ${config.chainId}, RPC ${config.rpcUrl}).`;
}

async function addThenSwitchOnProvider(
  walletProvider: Eip1193Provider,
  targetConfig: ValueChainNetworkConfig,
  actualChainId: number | null,
): Promise<EnsureNetworkResult> {
  const addParams = getAddEthereumChainParams(targetConfig);
  let addError: unknown = null;

  try {
    await walletProvider.request({
      method: 'wallet_addEthereumChain',
      params: [addParams],
    });
  } catch (err) {
    if (isWalletLockedError(err)) {
      return {
        ok: false,
        status: 'locked',
        chainId: actualChainId,
        targetChainId: targetConfig.chainId,
        chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
        canAutoSwitch: true,
        error: WALLET_LOCKED_MESSAGE,
      };
    }
    if (isUserRejectedError(err)) {
      return {
        ok: false,
        status: 'user_rejected',
        chainId: actualChainId,
        targetChainId: targetConfig.chainId,
        chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
        canAutoSwitch: true,
        error: `Adding ${targetConfig.name} was cancelled in your wallet. Approve the prompt to trade on SoDEX.`,
      };
    }
    addError = err;
  }

  try {
    await walletProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetConfig.chainIdHex }],
    });
    return {
      ok: true,
      status: 'added_and_switched',
      chainId: targetConfig.chainId,
      targetChainId: targetConfig.chainId,
      chainName: targetConfig.name,
      canAutoSwitch: true,
    };
  } catch (switchErr) {
    if (isWalletLockedError(switchErr)) {
      return {
        ok: false,
        status: 'locked',
        chainId: actualChainId,
        targetChainId: targetConfig.chainId,
        chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
        canAutoSwitch: true,
        error: WALLET_LOCKED_MESSAGE,
      };
    }
    if (isUserRejectedError(switchErr)) {
      return {
        ok: false,
        status: 'user_rejected',
        chainId: actualChainId,
        targetChainId: targetConfig.chainId,
        chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
        canAutoSwitch: true,
        error: `Switching to ${targetConfig.name} was cancelled in your wallet.`,
      };
    }
    const combinedErr = switchErr ?? addError;
    if (isUnsupportedSwitchMethodError(combinedErr)) {
      return {
        ok: false,
        status: 'manual_switch_required',
        chainId: actualChainId,
        targetChainId: targetConfig.chainId,
        chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
        canAutoSwitch: false,
        error: manualSwitchMessage(targetConfig),
      };
    }
    const detail = getUnknownErrorMessage(combinedErr, 'Unknown error');
    return {
      ok: false,
      status: 'failed',
      chainId: actualChainId,
      targetChainId: targetConfig.chainId,
      chainName: actualChainId ? getChainDisplayName(actualChainId) : null,
      canAutoSwitch: true,
      error: `Could not switch to ${targetConfig.name} (${targetConfig.chainId}): ${detail}`,
    };
  }
}

/**
 * Ensure the connected wallet is on the active ValueChain network.
 * 1. If already on target chainId -> immediate no-op.
 * 2. Tries `primaryWallet.switchNetwork(targetConfig.chainId)`.
 * 3. On failure (except user reject / wallet locked), falls back to
 *    `wallet_addEthereumChain` then `wallet_switchEthereumChain` on the
 *    connected wallet's own EIP-1193 provider (never blindly touching `window.ethereum`).
 */
export async function ensureWalletOnValueChain(options: {
  primaryWallet?: DynamicWalletLike | null;
  signer?: Signer | null;
  provider?: Eip1193Provider | null;
  targetConfig?: ValueChainNetworkConfig;
  allowLegacyWindowFallback?: boolean;
} = {}): Promise<EnsureNetworkResult> {
  const {
    primaryWallet,
    signer,
    provider,
    targetConfig = ACTIVE_VALUECHAIN,
    allowLegacyWindowFallback = false,
  } = options;

  const chainInfo = await getWalletChainId({
    primaryWallet,
    signer,
    provider,
    allowLegacyWindowFallback,
  });

  if (chainInfo.locked) {
    return {
      ok: false,
      status: 'locked',
      chainId: null,
      targetChainId: targetConfig.chainId,
      chainName: null,
      canAutoSwitch: true,
      error: chainInfo.error ?? WALLET_LOCKED_MESSAGE,
    };
  }

  if (chainInfo.chainId === targetConfig.chainId) {
    return {
      ok: true,
      status: 'already_on_chain',
      chainId: targetConfig.chainId,
      targetChainId: targetConfig.chainId,
      chainName: targetConfig.name,
      canAutoSwitch: true,
    };
  }

  const walletProvider = chainInfo.provider;

  if (primaryWallet?.connector?.switchNetworkOnlyFromWallet && !walletProvider) {
    return {
      ok: false,
      status: 'manual_switch_required',
      chainId: chainInfo.chainId,
      targetChainId: targetConfig.chainId,
      chainName: chainInfo.chainName,
      canAutoSwitch: false,
      error: manualSwitchMessage(targetConfig),
    };
  }

  // Primary path: Dynamic SDK `primaryWallet.switchNetwork`
  if (primaryWallet && typeof primaryWallet.switchNetwork === 'function') {
    try {
      await primaryWallet.switchNetwork(targetConfig.chainId);
      return {
        ok: true,
        status: 'switched',
        chainId: targetConfig.chainId,
        targetChainId: targetConfig.chainId,
        chainName: targetConfig.name,
        canAutoSwitch: true,
      };
    } catch (switchErr) {
      if (isWalletLockedError(switchErr)) {
        return {
          ok: false,
          status: 'locked',
          chainId: chainInfo.chainId,
          targetChainId: targetConfig.chainId,
          chainName: chainInfo.chainName,
          canAutoSwitch: true,
          error: WALLET_LOCKED_MESSAGE,
        };
      }
      if (isUserRejectedError(switchErr)) {
        return {
          ok: false,
          status: 'user_rejected',
          chainId: chainInfo.chainId,
          targetChainId: targetConfig.chainId,
          chainName: chainInfo.chainName,
          canAutoSwitch: true,
          error: `Network switch cancelled in your wallet. Switch to ${targetConfig.name} to trade on SoDEX.`,
        };
      }

      if (!walletProvider) {
        if (isUnsupportedSwitchMethodError(switchErr) || primaryWallet.connector?.switchNetworkOnlyFromWallet) {
          return {
            ok: false,
            status: 'manual_switch_required',
            chainId: chainInfo.chainId,
            targetChainId: targetConfig.chainId,
            chainName: chainInfo.chainName,
            canAutoSwitch: false,
            error: manualSwitchMessage(targetConfig),
          };
        }
        const msg = getUnknownErrorMessage(switchErr, 'No connected provider');
        return {
          ok: false,
          status: 'failed',
          chainId: chainInfo.chainId,
          targetChainId: targetConfig.chainId,
          chainName: chainInfo.chainName,
          canAutoSwitch: true,
          error: `Could not switch to ${targetConfig.name}: ${msg}`,
        };
      }

      // Fallback on connected provider: add chain first, then switch
      return addThenSwitchOnProvider(walletProvider, targetConfig, chainInfo.chainId);
    }
  }

  // Secondary path when only a connected EIP-1193 provider / signer is present (e.g. sodex order signing)
  if (!walletProvider) {
    return {
      ok: false,
      status: 'no_provider',
      chainId: chainInfo.chainId,
      targetChainId: targetConfig.chainId,
      chainName: chainInfo.chainName,
      canAutoSwitch: true,
      error: 'No connected wallet provider found.',
    };
  }

  try {
    await walletProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetConfig.chainIdHex }],
    });
    return {
      ok: true,
      status: 'switched',
      chainId: targetConfig.chainId,
      targetChainId: targetConfig.chainId,
      chainName: targetConfig.name,
      canAutoSwitch: true,
    };
  } catch (err) {
    if (isWalletLockedError(err)) {
      return {
        ok: false,
        status: 'locked',
        chainId: chainInfo.chainId,
        targetChainId: targetConfig.chainId,
        chainName: chainInfo.chainName,
        canAutoSwitch: true,
        error: WALLET_LOCKED_MESSAGE,
      };
    }
    if (isUserRejectedError(err)) {
      return {
        ok: false,
        status: 'user_rejected',
        chainId: chainInfo.chainId,
        targetChainId: targetConfig.chainId,
        chainName: chainInfo.chainName,
        canAutoSwitch: true,
        error: `Network switch cancelled in your wallet. Switch to ${targetConfig.name} to trade on SoDEX.`,
      };
    }
    if (isUnrecognizedChainError(err)) {
      return addThenSwitchOnProvider(walletProvider, targetConfig, chainInfo.chainId);
    }
    if (isUnsupportedSwitchMethodError(err)) {
      return {
        ok: false,
        status: 'manual_switch_required',
        chainId: chainInfo.chainId,
        targetChainId: targetConfig.chainId,
        chainName: chainInfo.chainName,
        canAutoSwitch: false,
        error: manualSwitchMessage(targetConfig),
      };
    }
    const msg = getUnknownErrorMessage(err, 'Unknown error');
    return {
      ok: false,
      status: 'failed',
      chainId: chainInfo.chainId,
      targetChainId: targetConfig.chainId,
      chainName: chainInfo.chainName,
      canAutoSwitch: true,
      error: `Could not switch to ${targetConfig.name} (${targetConfig.chainId}): ${msg}`,
    };
  }
}
