declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REWARDED_AD_GROUP_ID?: string;
  readonly VITE_FIRST_SENTENCE_PROMOTION_CODE?: string;
  readonly VITE_STUDY_10_PROMOTION_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
