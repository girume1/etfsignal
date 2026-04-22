import { ethers } from 'ethers';
import type { TradeOrder } from '../types';

const TESTNET_REST = 'https://testnet-gw.sodex.dev/api/v1/spot';
const CHAIN_ID = 138565; // SoDEX testnet

// ─── EIP712 Domain ────────────────────────────────────────────────────────

const domain = {
  name: 'spot',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

const types = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint64' },
  ],
};

// ─── Signing ──────────────────────────────────────────────────────────────

export async function signOrder(
  signer: ethers.Signer,
  payload: object,
  nonce: number
): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(payloadJson));

  const message = { payloadHash, nonce };
  const sig = await (signer as any).signTypedData(domain, { ExchangeAction: types.ExchangeAction }, message);

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
  order: TradeOrder
): Promise<PlaceOrderResult> {
  try {
    const nonce = Date.now();
    const symbolID = order.symbol === 'BTC-USDT' ? 1 : 2; // testnet symbol IDs

    const orderItem = {
      clOrdID: `etfsignal-${nonce}`,
      modifier: 1,
      side: order.side === 'BUY' ? 1 : 2,
      type: order.type === 'MARKET' ? 2 : 1,
      timeInForce: 3,
      quantity: order.quantity,
      reduceOnly: false,
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

    const result = await response.json();
    if (result.code === 0) {
      return { success: true, orderId: result.data?.orderId };
    }
    return { success: false, error: result.msg || 'Order failed' };
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
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { signer, address };
  } catch {
    return null;
  }
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
