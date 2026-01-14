/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROTOMAPS_API_KEY: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
