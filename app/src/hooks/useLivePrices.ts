import { useState, useEffect, useRef, useCallback } from 'react';

export interface LivePrices {
  BTC: number | null;
  ETH: number | null;
  /** True while the WebSocket connection to Binance is established */
  connected: boolean;
}

// Combined mini-ticker stream — fires on every price update (~1s cadence)
const WS_URL =
  'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker';

/**
 * Streams live BTC and ETH prices from Binance public WebSocket.
 * Auto-reconnects on disconnect (3-second back-off).
 * Safe to mount multiple times — each instance manages its own socket.
 *
 * Falls back gracefully if Binance is unreachable (prices stay null).
 */
export function useLivePrices(): LivePrices {
  const [prices, setPrices] = useState<LivePrices>({
    BTC: null,
    ETH: null,
    connected: false,
  });

  const wsRef      = useRef<WebSocket | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) setPrices(p => ({ ...p, connected: true }));
      };

      ws.onmessage = (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(e.data as string) as {
            stream: string;
            data: { c: string };
          };
          const price = parseFloat(msg.data?.c);
          if (isNaN(price)) return;

          if (msg.stream === 'btcusdt@miniTicker') {
            setPrices(p => ({ ...p, BTC: price }));
          } else if (msg.stream === 'ethusdt@miniTicker') {
            setPrices(p => ({ ...p, ETH: price }));
          }
        } catch { /* malformed frame — ignore */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setPrices(p => ({ ...p, connected: false }));
        timerRef.current = setTimeout(connect, 3_000); // reconnect
      };

      ws.onerror = () => ws.close(); // triggers onclose → reconnect

    } catch {
      // WebSocket constructor can throw in some envs (SSR, test)
      // just stay disconnected
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return prices;
}
