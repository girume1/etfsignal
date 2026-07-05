import { ethers } from 'ethers';
import type { TradeOrder, PerpsPosition } from '../types';

const TESTNET_GW  = 'https://testnet-gw.sodex.dev/api/v1/spot';
const PERPS_GW    = 'https://testnet-gw.sodex.dev/api/v1/perps';
const CHAIN_ID     = 138565;         // SoDEX testnet (ValueChain)
const CHAIN_ID_HEX = '0x21D45';     // hex for wallet_switchEthereumChain

// Symbol ID cache — populated at runtime from GET /markets/symbols
// Do NOT hardcode these; they may differ between testnet deployments.
const symbolIdCache: Record<string, number> = {};
// pricePrecision differs per market (BTC-USDC is whole dollars, ETH-USDC is $0.10
// ticks) — populated alongside symbolIdCache from the same /markets/symbols fetch.
const symbolPrecisionCache: Record<string, number> = {};

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
    const precision = Number(s.pricePrecision ?? 2);

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
      symbolPrecisionCache[symbol] = precision;
      return Number(id);
    }

    // Fallback: match by baseCoin/quoteCoin fields
    const sBase  = String(s.baseCoin  ?? s.baseAsset  ?? '').toUpperCase();
    const sQuote = String(s.quoteCoin ?? s.quoteAsset ?? '').toUpperCase();
    if (sBase === base && sQuote === quote) {
      symbolIdCache[symbol] = Number(id);
      symbolPrecisionCache[symbol] = precision;
      return Number(id);
    }
  }

  // Debug: log what symbols are actually available
  console.error('[sodex] available symbols:', json.data.map((s: any) => s.name ?? s.symbol).join(', '));
  throw new Error(`Symbol ${symbol} not found on SoDEX testnet`);
}

// ─── Perps symbol resolution ──────────────────────────────────────────────────
// Perps symbols are named "BTC-USD" directly (no V-prefix, unlike spot's VBTC_VUSDC).

const perpsSymbolIdCache: Record<string, number> = {};

async function resolvePerpsSymbolId(symbol: string): Promise<number> {
  if (perpsSymbolIdCache[symbol]) return perpsSymbolIdCache[symbol];

  const [base] = symbol.split('-'); // e.g. BTC

  const res = await fetch(`${PERPS_GW}/markets/symbols`);
  const json: any = await res.json();
  if (!Array.isArray(json.data)) {
    throw new Error('Could not fetch SoDEX perps symbol list');
  }

  for (const s of json.data) {
    const id = s.id ?? s.symbolID;
    if (!id) continue;

    const name = String(s.name ?? s.symbol ?? s.displayName ?? '').toUpperCase();
    if (name === symbol.toUpperCase() || name === `${base.toUpperCase()}-USD`) {
      perpsSymbolIdCache[symbol] = Number(id);
      return Number(id);
    }

    const sBase = String(s.baseCoin ?? s.baseAsset ?? '').toUpperCase();
    if (sBase === base.toUpperCase()) {
      perpsSymbolIdCache[symbol] = Number(id);
      return Number(id);
    }
  }

  console.error('[sodex] available perps symbols:', json.data.map((s: any) => s.name ?? s.symbol).join(', '));
  throw new Error(`Perps symbol ${symbol} not found on SoDEX testnet`);
}

// ─── EIP-712 Domain ───────────────────────────────────────────────────────────
// Spot uses domain.name "spot"; perps uses "futures" — same chain, same types.

function makeDomain(name: 'spot' | 'futures') {
  return {
    name,
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: '0x0000000000000000000000000000000000000000',
  };
}

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
// Spot and perps are separate sub-accounts on SoDEX — each has its own
// accounts/{address}/state endpoint and its own account ID.

async function fetchAccountId(address: string, baseUrl: string = TESTNET_GW): Promise<number> {
  const res = await fetch(`${baseUrl}/accounts/${address}/state`);
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

// ─── Perps position history ────────────────────────────────────────────────
// Public read, no signing needed. isTakenOver/takeOverPrice are SoDEX's own
// liquidation record — confirmed against their schema docs and live endpoint.

export async function fetchPerpsPositionHistory(address: string, limit = 20): Promise<PerpsPosition[]> {
  try {
    const res = await fetch(`${PERPS_GW}/accounts/${address}/positions/history?limit=${limit}`);
    if (!res.ok) return [];
    const json: any = await res.json();
    if (json.code !== 0 || !Array.isArray(json.data)) return [];
    return json.data as PerpsPosition[];
  } catch {
    return [];
  }
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
  domainName: 'spot' | 'futures' = 'spot',
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
      makeDomain(domainName),
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

// ─── Error translation ────────────────────────────────────────────────────────

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('cancel only'))
    return 'This market is temporarily paused on SoDEX testnet. Try BTC-USDC or check back later.';
  if (m.includes('no liquidity') || m.includes('insufficient liquidity'))
    return 'No liquidity on testnet — order submitted but no counterparty. This is expected on testnet.';
  if (m.includes('insufficient') || m.includes('balance'))
    return 'Insufficient balance. Claim testnet funds from the SoDEX faucet first.';
  if (m.includes('api key not found') || m.includes('unauthorized'))
    return 'Signing error — wallet may not be registered on SoDEX testnet. Visit testnet.sodex.com to register.';
  if (m.includes('notional is invalid'))
    return 'Order value is too small — below SoDEX testnet\'s minimum order size for this market ($5 spot, $10 perps).';
  if (m.includes('invalid payload') || m.includes('quantity is invalid'))
    return 'Invalid order size. Try a different amount.';
  return msg;
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
    if (order.type === 'LIMIT' && order.price) {
      // Each market has its own tick size (BTC-USDC is whole dollars, ETH-USDC is
      // $0.10 ticks) — a price with more decimals than the market allows is rejected
      // with "price is invalid". symbolPrecisionCache is populated by resolveSymbolId above.
      const precision = symbolPrecisionCache[order.symbol] ?? 2;
      orderItem.price = Number(order.price).toFixed(precision);
    }

    // funds = spend X USDC to buy base asset — MARKET BUY only (no price known in advance)
    // quantity = exact base asset amount — required for LIMIT orders and all SELL orders
    const baseAsset = order.symbol.split('-')[0];
    const usesFunds =
      order.type === 'MARKET' &&          // funds never valid for limit orders
      order.side === 'BUY' &&
      order.currency && order.currency !== baseAsset;
    if (usesFunds) {
      orderItem.funds = String(order.quantity);    // market BUY: spend X USDC
    } else {
      orderItem.quantity = String(order.quantity); // limit BUY/SELL or market SELL: X base asset
    }

    const requestBody = { accountID: aid, orders: [orderItem] };

    // 5. Sign the envelope: { type: 'batchNewOrder', params: requestBody }
    // Per SoDEX support: use wrapper with type "batchNewOrder" (not "newOrder").
    // The HTTP body is just requestBody — the wrapper is ONLY used for signing.
    const signingEnvelope = { type: 'batchNewOrder', params: requestBody };
    const typedSig = await signOrder(signer, signingEnvelope, nonce);

    console.log('[sodex] placing order', { accountID: aid, symbol: order.symbol, side: order.side, quantity: order.quantity, currency: order.currency });

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

    const raw2 = result.msg || result.message || result.error || `SoDEX error (HTTP ${response.status})`;
    // Translate known SoDEX testnet errors into human-readable messages
    const errMsg = friendlyError(raw2);
    return { success: false, error: errMsg };

  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ─── Perps (futures) orders ───────────────────────────────────────────────────
// Confirmed with SoDEX support: perps is a separate sub-account/endpoint from
// spot, signed with EIP-712 domain "futures" (not "spot"), envelope type
// "newOrder" (not "batchNewOrder"), submitted to /trade/orders (not /orders/batch).
//
// positionSide is ALWAYS 1 (BOTH) for new orders — per SoDEX's own schema,
// LONG(2)/SHORT(3) are declared but "not supported in order placement yet".
// Direction is controlled entirely by `side` (1=BUY/LONG, 2=SELL/SHORT).

export interface PerpsOrder {
  symbol: string;     // e.g. "BTC-USD"
  side: 'BUY' | 'SELL';
  quantity?: string;  // base-asset amount, e.g. "0.001" BTC — exactly one of quantity/funds
  funds?: string;     // USD-denominated size, e.g. "50" — schema allows funds on either side for perps
  leverage: number;
}

/**
 * Sets leverage before placing an order. Best-effort: SoDEX rejects leverage
 * changes while a position/open order exists on that symbol, which is a normal
 * condition (not a failure) once a position is already open at that leverage.
 */
async function setPerpsLeverage(
  signer: ethers.Signer,
  symbol: string,
  leverage: number,
): Promise<void> {
  const address = await signer.getAddress();
  const nonce = Date.now();
  const symbolID = await resolvePerpsSymbolId(symbol);
  const aid = await fetchAccountId(address, PERPS_GW);

  const requestBody = { accountID: aid, symbolID, leverage: Math.round(leverage), isIsolated: true };
  const signingEnvelope = { type: 'updateLeverage', params: requestBody };
  const typedSig = await signOrder(signer, signingEnvelope, nonce, 'futures');

  try {
    const response = await fetch(`${PERPS_GW}/trade/leverage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'X-API-Sign':   typedSig,
        'X-API-Nonce':  String(nonce),
        'X-API-Chain':  String(CHAIN_ID),
      },
      body: JSON.stringify(requestBody),
    });
    const raw = await response.text();
    console.log('[sodex] setPerpsLeverage response', response.status, raw);
  } catch (err) {
    console.warn('[sodex] setPerpsLeverage failed (non-fatal, likely an existing position):', err);
  }
}

export async function placePerpsOrder(
  signer: ethers.Signer,
  order: PerpsOrder,
): Promise<PlaceOrderResult> {
  try {
    await ensureSoDEXNetwork();

    const address = await signer.getAddress();
    const nonce   = Date.now();

    const symbolID = await resolvePerpsSymbolId(order.symbol);
    const aid = await fetchAccountId(address, PERPS_GW);

    // Best-effort — SoDEX rejects this if a position is already open on the symbol.
    await setPerpsLeverage(signer, order.symbol, order.leverage);

    // PerpsOrderItem field order (exact, per SoDEX schema):
    // clOrdID, modifier, side, type, timeInForce, price*, quantity*, funds*,
    // stopPrice*, stopType*, triggerType*, reduceOnly, positionSide  (*omitempty)
    // Exactly one of quantity/funds must be set — quantity if provided, else funds.
    const orderItem: Record<string, unknown> = {
      clOrdID:     `etfsignal-${nonce}`,
      modifier:    1,
      side:        order.side === 'BUY' ? 1 : 2,
      type:        2, // MARKET
      timeInForce: 3, // IOC
    };
    if (order.quantity) {
      orderItem.quantity = String(order.quantity);
    } else if (order.funds) {
      orderItem.funds = String(order.funds);
    }
    orderItem.reduceOnly = false;
    orderItem.positionSide = 1; // BOTH — always 1 for new orders (see note above)

    // PerpsNewOrderRequest: accountID, symbolID, orders
    const requestBody = { accountID: aid, symbolID, orders: [orderItem] };

    // Signing envelope: { type: 'newOrder', params: requestBody }, domain "futures"
    const signingEnvelope = { type: 'newOrder', params: requestBody };
    const typedSig = await signOrder(signer, signingEnvelope, nonce, 'futures');

    console.log('[sodex] placing perps order', { accountID: aid, symbol: order.symbol, side: order.side, quantity: order.quantity, funds: order.funds, leverage: order.leverage });
    console.log('[sodex] perps order item', orderItem);

    const response = await fetch(`${PERPS_GW}/trade/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'X-API-Sign':   typedSig,
        'X-API-Nonce':  String(nonce),
        'X-API-Chain':  String(CHAIN_ID),
      },
      body: JSON.stringify(requestBody),
    });

    const raw = await response.text();
    let result: any = {};
    try { result = JSON.parse(raw); } catch { /* non-JSON */ }

    console.log('[sodex] perps response', response.status, raw);

    if (response.ok && result.code === 0) {
      const first = result.data?.[0];
      if (first && first.code !== 0) {
        // Show the raw per-order detail (not just a generic fallback) so a
        // rejection reason SoDEX didn't put under msg/message is still visible.
        const detail = first.msg || first.message || first.error || first.reason
          || `rejected (code ${first.code}): ${JSON.stringify(first)}`;
        return { success: false, error: friendlyError(detail) };
      }
      const orderId = first?.orderID != null ? String(first.orderID) : first?.clOrdID ?? `sodex-${nonce}`;
      return { success: true, orderId };
    }

    const raw2 = result.msg || result.message || result.error || `SoDEX error (HTTP ${response.status})`;
    return { success: false, error: friendlyError(raw2) };

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
