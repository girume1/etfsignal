import { ethers } from 'ethers';
import type { TradeOrder } from '../types';

const TESTNET_GW  = 'https://testnet-gw.sodex.dev/api/v1/spot';
const CHAIN_ID     = 138565;         // SoDEX testnet (ValueChain)
const CHAIN_ID_HEX = '0x21D45';     // hex for wallet_switchEthereumChain

// Symbol ID cache — populated at runtime from GET /markets/symbols
// Do NOT hardcode these; they may differ between testnet deployments.
const symbolIdCache: Record<string, number> = {};

async function resolveSymbolId(symbol: string): Promise<number> {
  if (symbolIdCache[symbol]) return symbolIdCache[symbol];

  const [base, quote] = symbol.split('-');  // e.g. BTC, USDC

  const res = await fetch(`${TESTNET_GW}/markets/symbols`);
  const json: any = await res.json();
  if (!Array.isArray(json.data)) {
    throw new Error('Could not fetch SoDEX symbol list');
  }

  for (const s of json.data) {
    const id = s.symbolID ?? s.id;
    if (!id) continue;

    // Match by symbol name — case-insensitive, try multiple name variants
    // SoDEX testnet uses VBTC_VUSDC (all-caps), not vBTC_vUSDC
    const name = String(s.name ?? s.symbol ?? s.displayName ?? '').toUpperCase();
    const variants = [
      `V${base}_V${quote}`,          // VBTC_VUSDC  ← actual testnet format
      `${base}-${quote}`,            // BTC-USDC
      `${base}_${quote}`,            // BTC_USDC
      `${base}${quote}`,             // BTCUSDC
    ];
    if (variants.includes(name)) {
      symbolIdCache[symbol] = Number(id);
      return Number(id);
    }

    // Fallback: match by baseCoin/quoteCoin fields
    const sBase  = String(s.baseCoin  ?? s.baseAsset  ?? '').toUpperCase();
    const sQuote = String(s.quoteCoin ?? s.quoteAsset ?? '').toUpperCase();
    if (sBase === base && sQuote === quote) {
      symbolIdCache[symbol] = Number(id);
      return Number(id);
    }
  }

  // Debug: log what symbols are actually available
  console.error('[sodex] available symbols:', json.data.map((s: any) => s.name ?? s.symbol).join(', '));
  throw new Error(`Symbol ${symbol} not found on SoDEX testnet`);
}

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

/**
 * Serialize `value` to compact JSON with keys in the exact order they appear
 * in the Go struct definitions (Go's json.Marshal preserves struct field order).
 *
 * The server re-marshals the request body via json.Marshal and compares the
 * resulting hash against payloadHash — so key order must match exactly.
 *
 * Spot BatchNewOrderRequest field order (from sodex-go-sdk-public/spot/types):
 *   BatchNewOrderRequest: accountID, orders
 *   BatchNewOrderItem:    symbolID, clOrdID, side, type, timeInForce, price*, quantity*
 *   (* omitempty — omit when unset)
 *
 * The signing envelope adds: type, params
 */
function goJSON(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(goJSON).join(',') + ']';
  if (typeof value === 'object') {
    // Preserve insertion order — caller must build objects with fields in Go struct order
    const entries = Object.entries(value as Record<string, unknown>);
    return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + goJSON(v)).join(',') + '}';
  }
  return JSON.stringify(value);
}

export async function signOrder(
  signer: ethers.Signer,
  payload: object,
  nonce: number,
): Promise<string> {
  // Use standard JSON.stringify — SoDEX reference script uses JSON.stringify directly
  const payloadJson = JSON.stringify(payload);
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(payloadJson));

  // Debug — open browser console to verify recovered signer matches your wallet
  console.log('[sodex] signing payload JSON:', payloadJson);
  console.log('[sodex] payloadHash:', payloadHash);

  // nonce must be BigInt for uint64 EIP-712 encoding in ethers v6
  const message = { payloadHash, nonce: BigInt(nonce) };
  let rawSig: string;
  try {
    rawSig = await (signer as any).signTypedData(
      domain,
      { ExchangeAction: types.ExchangeAction },
      message,
    );
  } catch (err: any) {
    // Viem validates chainId on signTypedData — wallet must be on SoDEX testnet
    const msg: string = err?.message ?? String(err);
    if (msg.includes('chainId') || msg.includes('chain')) {
      throw new Error(
        `Wrong network. Switch your wallet to SoDEX Testnet (chain 138565).\n\n` +
        `Visit testnet.sodex.com and connect your wallet — it will add the network automatically.`
      );
    }
    throw err;
  }

  // Normalize signature to SoDEX wire format (matches reference script)
  // 0x01 prefix + r + s + v (where v is yParity: 0 or 1)
  const parsed = ethers.Signature.from(rawSig);
  const v = typeof parsed.yParity === 'number'
    ? parsed.yParity
    : parsed.v >= 27 ? parsed.v - 27 : parsed.v;

  const typedSig = ethers.hexlify(
    ethers.concat([
      new Uint8Array([1]),
      ethers.getBytes(parsed.r),
      ethers.getBytes(parsed.s),
      new Uint8Array([v]),
    ])
  );

  return typedSig;
}

// ─── Place Order ──────────────────────────────────────────────────────────────

export interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export async function placeSpotOrder(
  signer: ethers.Signer,
  _unusedAccountId: number,
  order: TradeOrder,
): Promise<PlaceOrderResult> {
  try {
    // 1. Switch to SoDEX testnet chain
    await ensureSoDEXNetwork();

    const address = await signer.getAddress();
    const nonce   = Date.now();

    // 2. Resolve symbolID dynamically from GET /markets/symbols
    const symbolID = await resolveSymbolId(order.symbol);

    // 3. Fetch account ID
    const aid = await fetchAccountId(address);

    // 4. Build request body in exact Go struct field order
    const orderItem: Record<string, unknown> = {
      symbolID,
      clOrdID:     `etfsignal-${nonce}`,
      side:        order.side === 'BUY' ? 1 : 2,
      type:        order.type === 'MARKET' ? 2 : 1,
      timeInForce: order.type === 'MARKET' ? 3 : 1,
    };
    if (order.type === 'LIMIT' && order.price) orderItem.price = String(order.price);
    orderItem.quantity = String(order.quantity);

    const requestBody = { accountID: aid, orders: [orderItem] };

    // 5. Sign the envelope: { type: 'batchNewOrder', params: requestBody }
    // Per SoDEX support: use wrapper with type "batchNewOrder" (not "newOrder").
    // The HTTP body is just requestBody — the wrapper is ONLY used for signing.
    const signingEnvelope = { type: 'batchNewOrder', params: requestBody };
    const typedSig = await signOrder(signer, signingEnvelope, nonce);

    console.log('[sodex] placing order', { accountID: aid, symbol: order.symbol, side: order.side, quantity: order.quantity });

    // 6. Submit — X-API-Chain header is required (confirmed from SoDEX reference script)
    const response = await fetch(`${TESTNET_GW}/trade/orders/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
        'X-API-Sign':   typedSig,
        'X-API-Nonce':  String(nonce),
        'X-API-Chain':  String(CHAIN_ID),   // required — missing this caused "API key not found"
      },
      body: JSON.stringify(requestBody),
    });

    const raw = await response.text();
    let result: any = {};
    try { result = JSON.parse(raw); } catch { /* non-JSON */ }

    console.log('[sodex] response', response.status, raw);

    if (response.ok && result.code === 0) {
      const orderId = result.data?.orders?.[0]?.ordId ?? result.data?.orders?.[0]?.clOrdID ?? `sodex-${nonce}`;
      return { success: true, orderId };
    }

    const errMsg = result.msg || result.message || result.error || `SoDEX error (HTTP ${response.status})`;
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
