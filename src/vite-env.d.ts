/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_HITBOXES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
