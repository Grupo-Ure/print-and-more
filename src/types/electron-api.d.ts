type NativeRevealResult = { ok: true } | { ok: false; error: string }

/** Native bridge exposed by the Electron preload (electron/preload.ts); absent in a plain browser tab. */
interface Window {
  auftrag?: {
    revealPath: (path: string) => Promise<NativeRevealResult>
    pickFiles: () => Promise<string[]>
    getPathForFile: (file: File) => string
  }
}
