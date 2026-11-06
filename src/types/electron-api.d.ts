/** App version baked in at build time from package.json (vite.config.ts `define`). */
declare const __APP_VERSION__: string

type NativeRevealResult = { ok: true } | { ok: false; error: string }

// Structured clone over IPC hands the renderer its own ArrayBuffer, never a shared one.
type NativeReadFileResult = { ok: true; data: Uint8Array<ArrayBuffer> } | { ok: false; error: string }

/** PKCE callback from the system browser: a single-use code, never a session. */
type NativeAuthCallback = { ok: true; code: string } | { ok: false; error: string }

/** Which copy of the app this is: a session id for the life of the process, and the machine's name. */
type NativeBackupIdentity = { sessionId: string; machine: string }

/** The app's folder on the shop's share, as `backup_settings` names it; empty parts are `null`. */
type NativeBackupShare = { server: string | null; share: string | null; folder: string | null }

/** Whether this machine can reach the shop folder now; `path` is where backups would go. */
type NativeBackupProbeResult =
  | { reachable: true; path: string; freeBytes: number }
  | { reachable: false; reason: string; path: string | null }

type NativeBackupDeliverResult = { ok: true; sha256: string; path: string } | { ok: false; error: string }

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
    backups: {
      identity: () => Promise<NativeBackupIdentity>
      /** Resolves the folder for this platform and checks it exists, is writable and has `requiredBytes` free; gives up after a few seconds. */
      probeFolder: (share: NativeBackupShare, requiredBytes?: number) => Promise<NativeBackupProbeResult>
      /** Streams the job's file from its signed link into `<folder>/Backups`, checked against `sha256` while writing and read back after. */
      deliver: (request: {
        share: NativeBackupShare
        url: string
        fileName: string
        sha256: string
        sizeBytes: number
      }) => Promise<NativeBackupDeliverResult>
    }
  }
}
