/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_PRAHARI_KEY?: string;
  readonly VITE_DEMO_RUN_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
