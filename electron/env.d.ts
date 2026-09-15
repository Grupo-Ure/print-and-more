/**
 * Build-time env vars Vite inlines into the main-process bundle (`VITE_` prefix
 * only). Mirrors the renderer-side declaration in src/types/env.d.ts.
 */
interface ImportMetaEnv {
  /** Sentry DSN; empty → error tracking disabled. */
  readonly VITE_SENTRY_DSN?: string
  /** Sentry environment tag; defaults to production/development by `app.isPackaged`. */
  readonly VITE_SENTRY_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
