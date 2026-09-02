import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { AuthCallback } from './deepLinks'

/** Subscribes to a main→renderer channel and returns its unsubscribe. */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

// The renderer-facing native API surface — the only thing that may cross the
// sandbox boundary. Mirrored for the renderer in src/types/electron-api.d.ts.
contextBridge.exposeInMainWorld('pam', {
  revealPath: (path: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('shell:reveal-path', path),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pick-files'),
  // Real disk path of a dropped/selected File object (the web platform hides it).
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  // Opens the OAuth sign-in page in the system browser; https only, enforced in main.
  openExternal: (url: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('shell:open-external', url),
  deepLinks: {
    /** Returns the order id a pam://order/<id> link parked, and clears it. */
    consumePending: (): Promise<string | null> => ipcRenderer.invoke('deeplink:consume-pending'),
    /** Fires when an order link arrives; the id is read via consumePending(). */
    onOrderLink: (listener: () => void): (() => void) =>
      subscribe<void>('deeplink:order', listener),
    /** Fires when the OAuth callback returns from the system browser. */
    onAuthCallback: (listener: (result: AuthCallback) => void): (() => void) =>
      subscribe<AuthCallback>('deeplink:auth', listener),
  },
})
