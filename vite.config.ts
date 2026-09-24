import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

/**
 * `VITE_` keys the bundle cannot run without. Checked here, before anything is
 * bundled, so a missing value stops the build with the key's name instead of
 * shipping a renderer that throws before it can render the login screen.
 */
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_GITHUB_RELEASES_URL'] as const

function assertRequiredEnv(env: Record<string, string>): void {
  const missing = REQUIRED_ENV.filter(key => !env[key]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in .env (see .env.example) or export them before building.'
    )
  }
}

export default defineConfig(({ mode }) => {
  // The VITE_ keys the build inlines, plus the build-machine-only Sentry
  // credentials (no VITE_ prefix → never inlined).
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'SENTRY_'])
  assertRequiredEnv(env)
  const sentryOrg = env.SENTRY_ORG?.trim() ?? ''
  const sentryProject = env.SENTRY_PROJECT?.trim() ?? ''
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN?.trim() ?? ''
  const uploadSourceMaps =
    mode === 'production' && sentryOrg !== '' && sentryProject !== '' && sentryAuthToken !== ''

  /** Fresh plugin instance per Vite build (renderer and Electron main are separate builds). */
  const sentryUpload = (): PluginOption[] =>
    uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: sentryOrg,
            project: sentryProject,
            authToken: sentryAuthToken,
            telemetry: false,
            release: { name: `print-and-more@${version}` },
            sourcemaps: {
              // Maps exist only for the upload; never ship them in the package.
              filesToDeleteAfterUpload: ['dist/**/*.map', 'dist-electron/**/*.map'],
            },
          }),
        ]
      : []

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      sourcemap: uploadSourceMaps ? 'hidden' : false,
    },
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              sourcemap: uploadSourceMaps ? 'hidden' : false,
            },
            plugins: sentryUpload(),
          },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              rolldownOptions: {
                // Sandboxed preload scripts cannot use ES modules — emit a
                // self-contained CJS file.
                output: { format: 'cjs', entryFileNames: 'preload.cjs' },
              },
            },
          },
        },
      }),
      ...sentryUpload(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Only e2e/support/testIds is meant to cross this boundary — the
        // data-testid registry shared with the Playwright page objects.
        '@e2e': path.resolve(__dirname, './e2e'),
      },
    },
  }
})
