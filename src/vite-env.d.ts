/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google review destination for the high-rating nudge (see ReviewPrompt). */
  readonly VITE_GOOGLE_REVIEW_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
