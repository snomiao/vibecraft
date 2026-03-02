/// <reference types="vite/client" />

import type { ElectronAPI } from './shared/types';

declare module '*.svg' {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  interface ImportMetaEnv {
    readonly VITE_APP_VERSION: string;
    readonly VITE_GIT_BRANCH?: string;
    readonly VITE_HOME_BG?: string;
    readonly VITE_DEV_HERO_PROVIDER?: string;
    readonly VITE_POSTHOG_API_KEY?: string;
    readonly VITE_POSTHOG_HOST?: string;
    readonly VITE_POSTHOG_RECORDING_DEV?: string;
  }
}

export {};
