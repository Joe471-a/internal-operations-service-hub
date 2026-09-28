/// <reference types="vite/client" />

/** The build-time settings the screen reads - see frontend/.env.example. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
