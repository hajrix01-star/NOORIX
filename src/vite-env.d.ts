/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_OFFICIAL_EMAIL_DOMAIN?: string;
}
