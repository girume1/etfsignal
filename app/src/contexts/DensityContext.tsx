import {
  createContext, useContext, useState, useEffect,
  type ReactNode,
} from 'react';

export type Density = 'compact' | 'comfortable' | 'mobile';
const STORAGE_KEY = 'etfsignal.density';

interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  auto: boolean;           // true if user hasn't manually picked — follows viewport
  setAuto: (v: boolean) => void;
  isMobile: boolean;       // viewport < 768
}

const DensityContext = createContext<DensityContextValue | null>(null);

function detectAutoDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w >= 1440) return 'comfortable';
  return 'compact';
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [auto, setAutoState] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === null;
  });
  const [density, setDensityState] = useState<Density>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Density | null;
    return stored ?? detectAutoDensity();
  });
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    function onResize() {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      if (auto) setDensityState(detectAutoDensity());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [auto]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setDensity = (d: Density) => {
    setAutoState(false);
    setDensityState(d);
    localStorage.setItem(STORAGE_KEY, d);
  };

  const setAuto = (v: boolean) => {
    setAutoState(v);
    if (v) {
      localStorage.removeItem(STORAGE_KEY);
      setDensityState(detectAutoDensity());
    }
  };

  return (
    <DensityContext.Provider value={{ density, setDensity, auto, setAuto, isMobile }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used inside DensityProvider');
  return ctx;
}
