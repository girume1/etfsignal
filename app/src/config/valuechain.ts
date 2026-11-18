import type { mergeNetworks } from '@dynamic-labs/sdk-react-core';

export type DynamicEvmNetwork = Parameters<typeof mergeNetworks>[0][number];

export interface ValueChainNetworkConfig {
  id: 'mainnet' | 'testnet';
  chainId: number;
  chainIdHex: `0x${string}`;
  /** Official wallet-facing chain name (e.g. "ValueChain") */
  name: string;
  /** Descriptive display label (e.g. "ValueChain Mainnet" / "ValueChain Testnet") */
  label: string;
  isTestnet: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  /**
   * RPC endpoint taken from pre-existing sodex.ts; not independently verified
   * (Chainlist lists no RPCs for 286623/138565). Confirm against SoDEX docs before deploy.
   */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  spotGateway: string;
  perpsGateway: string;
  sodexUrl: string;
  sodexHost: string;
  explorerPortfolioUrl: string;
  settlementCurrency: string;
}

export const USE_TESTNET = import.meta.env.VITE_SODEX_NETWORK === 'testnet';

export const VALUECHAIN_MAINNET: ValueChainNetworkConfig = {
  id: 'mainnet',
  chainId: 286623,
  chainIdHex: '0x45F9F',
  name: 'ValueChain',
  label: 'ValueChain Mainnet',
  isTestnet: false,
  nativeCurrency: {
    name: 'SOSO',
    symbol: 'SOSO',
    decimals: 18,
  },
  // Source: pre-existing sodex.ts L341 (unverified — confirm against SoDEX docs)
  rpcUrl: 'https://mainnet.valuechain.xyz',
  // Source: user/Chainlist facts & pre-existing sodex.ts L342
  explorerUrl: 'https://main-scan.valuechain.xyz',
  // Source: pre-existing sodex.ts L5-6
  spotGateway: 'https://mainnet-gw.sodex.dev/api/v1/spot',
  perpsGateway: 'https://mainnet-gw.sodex.dev/api/v1/perps',
  sodexUrl: 'https://sodex.com',
  sodexHost: 'sodex.com',
  explorerPortfolioUrl: 'https://sodex.com/portfolio?address=',
  settlementCurrency: 'USDC',
};

export const VALUECHAIN_TESTNET: ValueChainNetworkConfig = {
  id: 'testnet',
  chainId: 138565,
  chainIdHex: '0x21D45',
  name: 'ValueChain Testnet',
  label: 'ValueChain Testnet',
  isTestnet: true,
  nativeCurrency: {
    name: 'SOSO',
    symbol: 'SOSO',
    decimals: 18,
  },
  // Source: pre-existing sodex.ts L341 (unverified — confirm against SoDEX docs)
  rpcUrl: 'https://testnet.valuechain.xyz',
  // Source: pre-existing sodex.ts L342 (unverified — confirm against SoDEX docs)
  explorerUrl: 'https://testnet-scan.valuechain.xyz',
  // Source: pre-existing sodex.ts L7-8
  spotGateway: 'https://testnet-gw.sodex.dev/api/v1/spot',
  perpsGateway: 'https://testnet-gw.sodex.dev/api/v1/perps',
  sodexUrl: 'https://testnet.sodex.com',
  sodexHost: 'testnet.sodex.com',
  explorerPortfolioUrl: 'https://testnet.sodex.com/portfolio?address=',
  settlementCurrency: 'vUSDC',
};

export const ACTIVE_VALUECHAIN: ValueChainNetworkConfig = USE_TESTNET
  ? VALUECHAIN_TESTNET
  : VALUECHAIN_MAINNET;

export const CHAIN_ID: number = ACTIVE_VALUECHAIN.chainId;
export const CHAIN_ID_HEX: `0x${string}` = ACTIVE_VALUECHAIN.chainIdHex;

const KNOWN_EVM_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Smart Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  11155111: 'Sepolia',
  [VALUECHAIN_MAINNET.chainId]: VALUECHAIN_MAINNET.name,
  [VALUECHAIN_TESTNET.chainId]: VALUECHAIN_TESTNET.name,
};

/** Resolve a human-readable chain name from an EVM chain ID. */
export function getChainDisplayName(chainId: number | null | undefined): string {
  if (chainId == null || !Number.isFinite(chainId)) return 'Unknown network';
  return KNOWN_EVM_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

/** Parse hex ('0x45F9F'), decimal number (286623), '286623', or CAIP-2 ('eip155:286623') into numeric chainId. */
export function parseChainIdValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('eip155:')) {
      return parseChainIdValue(trimmed.slice('eip155:'.length));
    }
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const parsed = Number.parseInt(trimmed, 16);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
  }
  return null;
}

/** Build EIP-3085 `wallet_addEthereumChain` parameter object from the ValueChain config. */
export function getAddEthereumChainParams(config: ValueChainNetworkConfig = ACTIVE_VALUECHAIN) {
  return {
    chainId: config.chainIdHex,
    chainName: config.name,
    nativeCurrency: { ...config.nativeCurrency },
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.explorerUrl],
  };
}

/** Convert a ValueChain config into Dynamic SDK `GenericNetwork` shape for `overrides.evmNetworks`. */
export function toDynamicEvmNetwork(
  config: ValueChainNetworkConfig = ACTIVE_VALUECHAIN,
): DynamicEvmNetwork {
  return {
    blockExplorerUrls: [config.explorerUrl],
    chainId: config.chainId,
    chainName: config.name,
    iconUrls: [],
    isTestnet: config.isTestnet,
    name: config.name,
    nativeCurrency: { ...config.nativeCurrency },
    networkId: config.chainId,
    rpcUrls: [config.rpcUrl],
    vanityName: config.name,
  };
}

export const VALUECHAIN_DYNAMIC_NETWORK: DynamicEvmNetwork = toDynamicEvmNetwork(ACTIVE_VALUECHAIN);
