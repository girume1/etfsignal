/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DYNAMIC_ENVIRONMENT_ID?: string;
  readonly VITE_SODEX_NETWORK?: string;
  readonly VITE_SODEX_BUILDER_ID?: string;
  readonly VITE_SODEX_BUILDER_FEE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// MetaMask / EIP-1193 injected provider
interface Window {
  ethereum?: any;
}
