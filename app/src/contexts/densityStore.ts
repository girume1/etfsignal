import { createContext, useContext } from 'react';

export type Density = 'compact' | 'comfortable' | 'mobile';

export interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  auto: boolean;           // true if user hasn't manually picked — follows viewport
  setAuto: (v: boolean) => void;
  isMobile: boolean;       // viewport < 768
}

export const DensityContext = createContext<DensityContextValue | null>(null);

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used inside DensityProvider');
  return ctx;
}
