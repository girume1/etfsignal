import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type SourceStatus = 'unknown' | 'live' | 'error';

export interface ConnectionStatus {
  sosovalue: SourceStatus;
  binance: SourceStatus;
  claude: SourceStatus;
}

export interface ConnectionStatusContextValue {
  status: ConnectionStatus;
  setSourceStatus: (source: keyof ConnectionStatus, s: SourceStatus) => void;
}

const ConnectionStatusContext = createContext<ConnectionStatusContextValue | null>(null);

const INITIAL_STATUS: ConnectionStatus = {
  sosovalue: 'unknown',
  binance: 'unknown',
  claude: 'unknown',
};

export function ConnectionStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(INITIAL_STATUS);

  const setSourceStatus = useCallback(
    (source: keyof ConnectionStatus, s: SourceStatus) => {
      setStatus(prev => ({ ...prev, [source]: s }));
    },
    [],
  );

  return (
    <ConnectionStatusContext.Provider value={{ status, setSourceStatus }}>
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionStatusContextValue {
  const ctx = useContext(ConnectionStatusContext);
  if (!ctx) throw new Error('useConnectionStatus must be used inside ConnectionStatusProvider');
  return ctx;
}
