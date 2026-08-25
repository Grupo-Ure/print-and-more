import { contextBridge } from 'electron'

// The renderer-facing native API surface. Deliberately empty for now — it
// grows per work package (WP5: revealPath, WP9: deepLinks); nothing else may
// cross the sandbox boundary.
contextBridge.exposeInMainWorld('auftrag', {})
