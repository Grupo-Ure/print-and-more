import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

export default defineConfig(({ mode }) => {
  // Build-machine-only Sentry credentials (no VITE_ prefix → never inlined).
  const env = loadEnv(mode, process.cwd(), 'SENTRY_')
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
      },
    },
  }
})
