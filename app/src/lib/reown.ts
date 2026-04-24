import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';

const projectId = 'b205221a78d0c561dac20b5a1e744d1f';

/**
 * SoDEX ValueChain Testnet — chainId 138565
 * RPC / explorer from SoDEX testnet onboarding docs.
 */
const valueChainTestnet = defineChain({
  id: 138565,
  caipNetworkId: 'eip155:138565',
  chainNamespace: 'eip155',
  name: 'SoDEX ValueChain Testnet',
  nativeCurrency: { name: 'VALUE', symbol: 'VALUE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.sodex.dev'] },
  },
  blockExplorers: {
    default: {
      name: 'SoDEX Explorer',
      url: 'https://testnet-explorer.sodex.dev',
    },
  },
  testnet: true,
});

const ethersAdapter = new EthersAdapter();

/**
 * Singleton AppKit instance — imported at app boot (App.tsx) so the modal
 * web-component is registered before any React tree renders.
 *
 * Call `modal.open()` to show the wallet selector,
 * `modal.disconnect()` to clear the session.
 */
export const modal = createAppKit({
  adapters: [ethersAdapter],
  networks: [valueChainTestnet],
  defaultNetwork: valueChainTestnet,
  projectId,
  metadata: {
    name: 'ETFSignal AI',
    description: 'AI-Powered BTC/ETH ETF Intelligence & Signal-to-Execution Platform',
    url: 'https://etfsignal.vercel.app',
    icons: ['https://etfsignal.vercel.app/favicon.png'],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#0057FF',
    '--w3m-border-radius-master': '8px',
    '--w3m-font-family': 'DM Sans, sans-serif',
  },
});
