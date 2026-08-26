import { contextBridge, ipcRenderer } from 'electron'

// The renderer-facing native API surface — the only thing that may cross the
// sandbox boundary. Mirrored for the renderer in src/types/electron-api.d.ts.
contextBridge.exposeInMainWorld('auftrag', {
  revealPath: (path: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('shell:reveal-path', path),
  pickFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pick-file'),
})
