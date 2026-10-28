import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { consumePendingOrderId } from './deepLinks'

type RevealResult = { ok: true } | { ok: false; error: string }

type ReadFileResult = { ok: true; data: Uint8Array } | { ok: false; error: string }

const MAX_PATH_LENGTH = 2000
const MAX_URL_LENGTH = 4000
// A proof copied for the customer's approval page; anything larger is not a
// proof but a production file, and would only stall the upload.
const MAX_READ_BYTES = 100 * 1024 * 1024

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

  // Hands a linked file's bytes to the renderer, which uploads a copy for the
  // customer's approval page — the edge function cannot reach the share. Only
  // a plain file is read; a path that climbs out with `..` is refused outright.
  ipcMain.handle('fs:read-file', async (_event, rawPath: unknown): Promise<ReadFileResult> => {
    if (!isSanePath(rawPath)) return { ok: false, error: 'Invalid path.' }
    const target =
      process.platform === 'win32' ? rawPath.trim().replace(/\//g, '\\') : rawPath.trim()
    if (target.split(/[\\/]/).includes('..')) return { ok: false, error: 'Invalid path.' }

    let size: number
    try {
      const stat = await fs.stat(target)
      if (!stat.isFile()) return { ok: false, error: 'Not a file.' }
      size = stat.size
    } catch {
      return { ok: false, error: 'File not reachable — it does not exist, or the share is offline.' }
    }
    if (size > MAX_READ_BYTES) return { ok: false, error: 'File is too large to send for approval.' }

    try {
      return { ok: true, data: new Uint8Array(await fs.readFile(target)) }
    } catch {
      return { ok: false, error: 'File could not be read.' }
    }
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
