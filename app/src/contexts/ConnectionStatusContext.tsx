import { useState, useCallback, type ReactNode } from 'react';
import {
  ConnectionStatusContext,
  type ConnectionStatus,
  type SourceStatus,
} from './connectionStatusStore';

const INITIAL_STATUS: ConnectionStatus = {
  sosovalue: 'unknown',
  binance: 'unknown',
  ai: 'unknown',
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
