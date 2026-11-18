import { createContext, useContext } from 'react';

export type SourceStatus = 'unknown' | 'live' | 'error';

export interface ConnectionStatus {
  sosovalue: SourceStatus;
  binance: SourceStatus;
  ai: SourceStatus;
}

export interface ConnectionStatusContextValue {
  status: ConnectionStatus;
  setSourceStatus: (source: keyof ConnectionStatus, s: SourceStatus) => void;
}

export const ConnectionStatusContext = createContext<ConnectionStatusContextValue | null>(null);

export function useConnectionStatus(): ConnectionStatusContextValue {
  const ctx = useContext(ConnectionStatusContext);
  if (!ctx) throw new Error('useConnectionStatus must be used inside ConnectionStatusProvider');
  return ctx;
}
