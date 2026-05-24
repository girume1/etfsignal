import { ethers } from 'ethers';
import type { TradeOrder } from '../types';

const TESTNET_REST = 'https://testnet-gw.sodex.dev/api/v1/spot';
const CHAIN_ID     = 138565;         // SoDEX testnet (ValueChain)
const CHAIN_ID_HEX = '0x21D45';     // hex for wallet_switchEthereumChain

// ─── EIP712 Domain ────────────────────────────────────────────────────────

const domain = {
  name: 'spot',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

const types = {
  EIP712Domain: [
    { name: 'name',             type: 'string'  },
    { name: 'version',          type: 'string'  },
    { name: 'chainId',          type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce',       type: 'uint64'  },
  ],
};

// ─── Network switch ───────────────────────────────────────────────────────
// Must be on SoDEX testnet before EIP-712 signing or the wallet will reject it.

async function ensureSoDEXNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error('No wallet found. Please install MetaMask.');

  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(currentChain, 16) === CHAIN_ID) return; // already on correct chain

  try {
    // Try switching — works if the user already added SoDEX testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (switchErr: any) {
    // Error 4902 = chain not added to wallet yet
    if (switchErr.code === 4902) {
      throw new Error(
        'SoDEX Testnet is not in your wallet yet.\n\n' +
        '1. Go to https://testnet.sodex.com and connect your wallet — it will auto-add the network.\n' +
        '2. Come back here and try again.'
      );
    }
    throw new Error(`Could not switch to SoDEX Testnet: ${switchErr.message ?? switchErr}`);
  }
}

// ─── Signing ──────────────────────────────────────────────────────────────

export async function signOrder(
  signer: ethers.Signer,
  payload: object,
  nonce: number,
): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(payloadJson));

  const message = { payloadHash, nonce };
  const sig = await (signer as any).signTypedData(
    domain,
    { ExchangeAction: types.ExchangeAction },
    message,
  );

  // Prepend byte 0x01 for typed signature
  return '0x01' + sig.slice(2);
}

// ─── Place Order ──────────────────────────────────────────────────────────

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export async function placeSpotOrder(
  signer: ethers.Signer,
  accountId: number,
  order: TradeOrder,
): Promise<PlaceOrderResult> {
  try {
    // Switch to SoDEX testnet before signing — otherwise wallet rejects EIP-712
    await ensureSoDEXNetwork();

    const nonce    = Date.now();
    const symbolID = order.symbol === 'BTC-USDC' ? 1 : 2; // SoDEX testnet USDC pairs

    const orderItem = {
      clOrdID:      `etfsignal-${nonce}`,
      modifier:     1,
      side:         order.side === 'BUY' ? 1 : 2,
      type:         order.type === 'MARKET' ? 2 : 1,
      timeInForce:  3,
      quantity:     order.quantity,
      reduceOnly:   false,
      positionSide: 1,
      ...(order.type === 'LIMIT' && order.price ? { price: order.price } : {}),
    };

    const payload = {
      type: 'newOrder',
      params: {
        accountID: accountId,
        symbolID,
        orders: [orderItem],
      },
    };

    const typedSig = await signOrder(signer, payload, nonce);

    const response = await fetch(`${TESTNET_REST}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload.params, signature: typedSig, nonce }),
    });

    // SoDEX sometimes returns HTML on error — parse safely
    const raw = await response.text();
    let result: any = {};
    try { result = JSON.parse(raw); } catch {
      return { success: false, error: `SoDEX error (HTTP ${response.status}): ${raw.slice(0, 120)}` };
    }
    if (result.code === 0) {
      return { success: true, orderId: result.data?.orderId };
    }
    return { success: false, error: result.msg || `Order failed (code ${result.code})` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ─── Wallet Utils ─────────────────────────────────────────────────────────

export async function connectWallet(): Promise<{ signer: ethers.Signer; address: string } | null> {
  if (!window.ethereum) {
    alert('MetaMask is required. Please install it.');
    return null;
  }
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer  = await provider.getSigner();
    const address = await signer.getAddress();
    return { signer, address };
  } catch {
    return null;
  }
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
