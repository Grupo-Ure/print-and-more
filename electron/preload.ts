import { contextBridge, ipcRenderer, webUtils } from 'electron'

// The renderer-facing native API surface — the only thing that may cross the
// sandbox boundary. Mirrored for the renderer in src/types/electron-api.d.ts.
contextBridge.exposeInMainWorld('pam', {
  revealPath: (path: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('shell:reveal-path', path),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pick-files'),
  // Real disk path of a dropped/selected File object (the web platform hides it).
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
})
