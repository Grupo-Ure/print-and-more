import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { consumePendingOrderId } from './deepLinks'

type RevealResult = { ok: true } | { ok: false; error: string }

const MAX_PATH_LENGTH = 2000
const MAX_URL_LENGTH = 4000

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

  // Hands a URL to the system browser — used for the OAuth sign-in leg, which
  // must not happen inside the app window. https only: a renderer must never
  // be able to launch an arbitrary program via file: or a foreign scheme.
  ipcMain.handle('shell:open-external', async (_event, rawUrl: unknown): Promise<RevealResult> => {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
      return { ok: false, error: 'Invalid URL.' }
    }
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return { ok: false, error: 'Invalid URL.' }
    }
    if (parsed.protocol !== 'https:') return { ok: false, error: 'Only https links can be opened.' }

    await shell.openExternal(rawUrl)
    return { ok: true }
  })

  ipcMain.handle('deeplink:consume-pending', (): string | null => consumePendingOrderId())

  ipcMain.handle('dialog:pick-files', async (event): Promise<string[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Select files to link',
      properties: ['openFile' as const, 'multiSelections' as const],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })
}
