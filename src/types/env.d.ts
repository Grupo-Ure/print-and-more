/** Build-time env vars (Vite inlines `VITE_`-prefixed keys). Augments vite/client's ImportMetaEnv. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Sentry DSN; empty → error tracking disabled. */
  readonly VITE_SENTRY_DSN?: string
  /** Sentry environment tag; defaults to Vite's MODE. */
  readonly VITE_SENTRY_ENVIRONMENT?: string
  /** GitHub Releases API URL for the release notes page; no default — the build fails without it. */
  readonly VITE_GITHUB_RELEASES_URL: string
}
