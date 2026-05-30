import { ethers } from 'ethers';
import type { TradeOrder } from '../types';

const TESTNET_GW  = 'https://testnet-gw.sodex.dev/api/v1/spot';
const CHAIN_ID     = 138565;         // SoDEX testnet (ValueChain)
const CHAIN_ID_HEX = '0x21D45';     // hex for wallet_switchEthereumChain

// SoDEX testnet symbol IDs (from GET /markets/symbols)
const SYMBOL_ID_MAP: Record<string, number> = {
  'BTC-USDC': 1,   // vBTC_vUSDC
  'ETH-USDC': 2,   // vETH_vUSDC
};

// ─── EIP-712 Domain ───────────────────────────────────────────────────────────

const domain = {
  name: 'spot',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

const types = {
  EIP712Domain: [
    { name: 'name',              type: 'string'  },
    { name: 'version',           type: 'string'  },
    { name: 'chainId',           type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce',       type: 'uint64'  },
  ],
};

// ─── Network switch ───────────────────────────────────────────────────────────

async function ensureSoDEXNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error('No wallet found. Please install MetaMask.');

  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(currentChain, 16) === CHAIN_ID) return;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (switchErr: any) {
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

// ─── Account ID ───────────────────────────────────────────────────────────────

async function fetchAccountId(address: string): Promise<number> {
  const res = await fetch(`${TESTNET_GW}/accounts/${address}/state`);
  const raw = await res.text();
  let json: any = {};
  try { json = JSON.parse(raw); } catch { /* non-JSON */ }

  if (!res.ok || json.code !== 0) {
    const msg = json.msg || json.message || json.error || `HTTP ${res.status}`;
    throw new Error(
      `SoDEX account not found (${msg}).\n` +
      'Please connect your wallet at https://testnet.sodex.com first to register your account.'
    );
  }

  const aid = json.data?.aid ?? json.data?.accountId ?? json.data?.id ?? json.data?.account_id;
  if (!aid) {
    throw new Error(
      'Could not read account ID from SoDEX.\n' +
      'Please connect your wallet at https://testnet.sodex.com first.'
    );
  }
  return Number(aid);
}

// ─── Balances ─────────────────────────────────────────────────────────────────
// Calls our /api/sodex-balance proxy (server-side, avoids CORS).
// Returns { BTC: '0.1234', USDC: '987.65', ETH: '0.5' }  (v-prefix stripped)

export async function fetchBalances(address: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`/api/sodex-balance?address=${encodeURIComponent(address)}`);
    if (!res.ok) return {};
    const json: any = await res.json();
    if (json.ok && json.balances && Object.keys(json.balances).length > 0) {
      return json.balances as Record<string, string>;
    }
  } catch { /* fall through */ }
  return {};
}

// ─── EIP-712 signing ──────────────────────────────────────────────────────────

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

  // Prepend 0x01 to indicate typed (EIP-712) signature
  return '0x01' + sig.slice(2);
}

// ─── Place Order ──────────────────────────────────────────────────────────────

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export async function placeSpotOrder(
  signer: ethers.Signer,
  _unusedAccountId: number,   // kept for call-site compatibility; fetched dynamically below
  order: TradeOrder,
): Promise<PlaceOrderResult> {
  try {
    // 1. Switch to SoDEX testnet chain
    await ensureSoDEXNetwork();

    const address  = await signer.getAddress();
    const nonce    = Date.now();

    // 2. Resolve testnet symbolID (numeric, per SoDEX spot schema)
    const symbolID = SYMBOL_ID_MAP[order.symbol];
    if (!symbolID) throw new Error(`Unknown symbol: ${order.symbol}`);

    // 3. Fetch real account ID for this wallet
    const aid = await fetchAccountId(address);

    // 4. Build the batch-order request body (camelCase per SoDEX spot API schema)
    // Spot orders: symbolID + clOrdID + side + type + timeInForce + quantity/funds
    // No Modifier / PositionSide / ReduceOnly — those are futures-only fields
    const orderItem: Record<string, unknown> = {
      symbolID,
      clOrdID:     `etfsignal-${nonce}`,
      side:        order.side === 'BUY' ? 1 : 2,   // 1=BUY, 2=SELL
      type:        order.type === 'MARKET' ? 2 : 1, // 1=LIMIT, 2=MARKET
      timeInForce: order.type === 'MARKET' ? 3 : 1, // IOC for market, GTC for limit
      quantity:    String(order.quantity),           // DecimalString
    };
    if (order.type === 'LIMIT' && order.price) {
      orderItem.price = String(order.price);         // DecimalString, limit orders only
    }

    const requestBody = {
      accountID: aid,
      orders:    [orderItem],
    };

    // 5. EIP-712 sign the request body
    const typedSig = await signOrder(signer, requestBody, nonce);

    // 6. Submit to SoDEX batch orders endpoint
    const response = await fetch(`${TESTNET_GW}/trade/orders/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':   address,
        'X-API-Sign':  typedSig,
        'X-API-Nonce': String(nonce),
      },
      body: JSON.stringify(requestBody),
    });

    const raw = await response.text();
    let result: any = {};
    try { result = JSON.parse(raw); } catch { /* non-JSON response */ }

    if (response.ok && result.code === 0) {
      const orderId =
        result.data?.orders?.[0]?.ordId   ??
        result.data?.orders?.[0]?.clOrdID ??
        result.data?.orderId              ??
        `sodex-${nonce}`;
      return { success: true, orderId };
    }

    const errMsg =
      result.msg     ||
      result.message ||
      result.error   ||
      `SoDEX error (HTTP ${response.status})`;
    return { success: false, error: errMsg };

  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ─── Wallet utils ─────────────────────────────────────────────────────────────

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
