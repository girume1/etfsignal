/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOSOVALUE_API_KEY?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// MetaMask / EIP-1193 injected provider
interface Window {
  ethereum?: any;
}
