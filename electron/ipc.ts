import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'

type RevealResult = { ok: true } | { ok: false; error: string }

const MAX_PATH_LENGTH = 2000

function isSanePath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_PATH_LENGTH) return false
  for (const char of trimmed) {
    if (char.charCodeAt(0) < 0x20) return false
  }
  return true
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target)
    return true
  } catch {
    return false
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('shell:reveal-path', async (_event, rawPath: unknown): Promise<RevealResult> => {
    if (!isSanePath(rawPath)) return { ok: false, error: 'Invalid path.' }
    const target =
      process.platform === 'win32' ? rawPath.trim().replace(/\//g, '\\') : rawPath.trim()

    if (await exists(target)) {
      shell.showItemInFolder(target)
      return { ok: true }
    }

    const parent = path.dirname(target)
    if (parent !== target && (await exists(parent))) {
      const openError = await shell.openPath(parent)
      if (openError) return { ok: false, error: openError }
      return { ok: true }
    }

    return {
      ok: false,
      error: 'Path not reachable — the file and its folder do not exist, or the share is offline.',
    }
  })

  ipcMain.handle('dialog:pick-file', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Select file to link', properties: ['openFile' as const] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
