/** App version baked in at build time from package.json (vite.config.ts `define`). */
declare const __APP_VERSION__: string

type NativeRevealResult = { ok: true } | { ok: false; error: string }

/** Native bridge exposed by the Electron preload (electron/preload.ts); absent in a plain browser tab. */
interface Window {
  pam?: {
    revealPath: (path: string) => Promise<NativeRevealResult>
    pickFiles: () => Promise<string[]>
    getPathForFile: (file: File) => string
  }
}
