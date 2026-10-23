/** App version baked in at build time from package.json (vite.config.ts `define`). */
declare const __APP_VERSION__: string

type NativeRevealResult = { ok: true } | { ok: false; error: string }

// Structured clone over IPC hands the renderer its own ArrayBuffer, never a shared one.
type NativeReadFileResult = { ok: true; data: Uint8Array<ArrayBuffer> } | { ok: false; error: string }

/** PKCE callback from the system browser: a single-use code, never a session. */
type NativeAuthCallback = { ok: true; code: string } | { ok: false; error: string }

/** Native bridge exposed by the Electron preload (electron/preload.ts); absent in a plain browser tab. */
interface Window {
  pam?: {
    revealPath: (path: string) => Promise<NativeRevealResult>
    pickFiles: () => Promise<string[]>
    getPathForFile: (file: File) => string
    /** A linked file's bytes (the approval proof upload); refused for anything but a plain file. */
    readFile: (path: string) => Promise<NativeReadFileResult>
    openExternal: (url: string) => Promise<NativeRevealResult>
    deepLinks: {
      consumePending: () => Promise<string | null>
      /** Returns its own unsubscribe. */
      onOrderLink: (listener: () => void) => () => void
      /** Returns its own unsubscribe. */
      onAuthCallback: (listener: (result: NativeAuthCallback) => void) => () => void
    }
  }
}
