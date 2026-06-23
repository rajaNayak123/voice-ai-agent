/// <reference types="vite/client" />

declare module "*?url" {
  const url: string;
  export default url;
}

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
