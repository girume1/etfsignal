// Vercel Node.js Serverless Function — SoDEX order proxy
// Signs and submits spot orders server-side using the registered API key.
// The API key private key never reaches the browser.
// Uses only Node.js built-ins (crypto) — no ethers dependency needed.
//
// POST /api/sodex-order
// Body: { accountID, symbol, side, type, quantity, price? }

// ethers is installed at the root level (root package.json) so it's available to all api/ functions
const TESTNET_GW = 'https://testnet-gw.sodex.dev/api/v1/spot';
const CHAIN_ID   = 138565;

// Symbol ID cache — fetched at runtime, not hardcoded
const symbolIdCache: Record<string, number> = {};

async function resolveSymbolId(symbol: string): Promise<number> {
  if (symbolIdCache[symbol]) return symbolIdCache[symbol];
  const parts = symbol.split('-');
  const sodexSymbol = `v${parts[0]}_v${parts[1]}`;
  const res = await fetch(`${TESTNET_GW}/markets/symbols`);
  const json: any = await res.json();
  if (json.code !== 0 || !Array.isArray(json.data)) {
    throw new Error('Could not fetch SoDEX symbol list');
  }
  for (const s of json.data) {
    if (s.symbol === sodexSymbol && s.symbolID) {
      symbolIdCache[symbol] = s.symbolID;
      return s.symbolID;
    }
  }
  throw new Error(`Symbol ${symbol} (${sodexSymbol}) not found on SoDEX testnet`);
}

/** Compact JSON preserving insertion order (matches Go's json.Marshal struct field order). */
function goJSON(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(goJSON).join(',') + ']';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + goJSON(v)).join(',') + '}';
  }
  return JSON.stringify(value);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SoDEX testnet: master wallet mode — no named API key required.
  // Set SODEX_PRIVATE_KEY to the master wallet private key (or use SODEX_API_KEY_PRIVATE for backward compat).
  const privateKey = process.env.SODEX_PRIVATE_KEY ?? process.env.SODEX_API_KEY_PRIVATE;
  const apiKeyName = process.env.SODEX_API_KEY_NAME; // optional — only used if a named API key is registered

  if (!privateKey) {
    return res.status(500).json({ error: 'SODEX_PRIVATE_KEY not configured' });
  }

  const { accountID, symbol, side, type: orderType, quantity, price } = req.body ?? {};

  if (!accountID || !symbol || !side || !orderType || !quantity) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  try {
    // Dynamically import ethers from the app's node_modules
    // Vercel bundles the api/ folder together with the app dependencies
    const { ethers } = await import('ethers');

    // Resolve symbolID at runtime — do NOT hardcode (support team reply #2)
    const symbolID = await resolveSymbolId(symbol);

    const nonce = Date.now();

    // Build order item in exact Go struct field order:
    // BatchNewOrderItem: symbolID, clOrdID, side, type, timeInForce, price (omitempty), quantity
    const orderItem: Record<string, unknown> = {
      symbolID,
      clOrdID:     `etfsignal-${nonce}`,
      side:        side === 'BUY' ? 1 : 2,
      type:        orderType === 'MARKET' ? 2 : 1,
      timeInForce: orderType === 'MARKET' ? 3 : 1,
    };
    if (orderType === 'LIMIT' && price) {
      orderItem.price = String(price);
    }
    orderItem.quantity = String(quantity);

    // BatchNewOrderRequest: accountID, orders
    const requestBody = {
      accountID: Number(accountID),
      orders:    [orderItem],
    };

    // Signing envelope: type, params
    const signingEnvelope = { type: 'batchNewOrder', params: requestBody };
    const payloadJson = goJSON(signingEnvelope);
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(payloadJson));

    const domain = {
      name: 'spot',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    };

    const types = {
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce',       type: 'uint64'  },
      ],
    };

    // Sign with master wallet private key (or named API key private key if configured)
    const wallet  = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    const message = { payloadHash, nonce: BigInt(nonce) };
    const rawSig  = await wallet.signTypedData(domain, types, message);

    // Normalize v and prepend 0x01 type prefix
    const parsed = ethers.Signature.from(rawSig);
    const r = parsed.r.slice(2);
    const s = parsed.s.slice(2);
    const v = (parsed.v - 27).toString(16).padStart(2, '0');
    const typedSig = '0x01' + r + s + v;

    console.log('[sodex-order] submitting', { accountID, symbol, symbolID, side, orderType, quantity });
    console.log('[sodex-order] payload JSON:', payloadJson);
    console.log('[sodex-order] payloadHash:', payloadHash);
    console.log('[sodex-order] signer:', wallet.address);

    // Submit — master wallet mode: no X-API-Key header.
    // X-API-Chain is included (matches SoDEX reference script).
    const submitHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'X-API-Sign':   typedSig,
      'X-API-Nonce':  String(nonce),
      'X-API-Chain':  String(CHAIN_ID),
    };
    if (apiKeyName) submitHeaders['X-API-Key'] = apiKeyName; // only if named API key is registered

    const response = await fetch(`${TESTNET_GW}/trade/orders/batch`, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify(requestBody),
    });

    const raw = await response.text();
    let result: any = {};
    try { result = JSON.parse(raw); } catch { /* non-JSON */ }

    console.log('[sodex-order] response', response.status, raw);

    if (response.ok && result.code === 0) {
      const orderId =
        result.data?.orders?.[0]?.ordId   ??
        result.data?.orders?.[0]?.clOrdID ??
        `sodex-${nonce}`;
      return res.json({ success: true, orderId });
    }

    const errMsg = result.msg || result.message || result.error || `SoDEX error (HTTP ${response.status})`;
    return res.json({ success: false, error: errMsg });

  } catch (err: any) {
    console.error('[sodex-order] error', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Unknown error' });
  }
}
