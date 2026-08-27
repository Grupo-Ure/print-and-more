import fs from 'node:fs'
import path from 'node:path'
import { app, screen, type BrowserWindow, type Rectangle } from 'electron'

export type WindowState = {
  bounds: Rectangle | null
  isMaximized: boolean
}

// First run (no saved state): open maximized at a sane un-maximize size.
const DEFAULT_STATE: WindowState = { bounds: null, isMaximized: true }

const SAVE_DEBOUNCE_MS = 500

function stateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function intersects(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  )
}

/** Saved bounds are only trusted if they still overlap a connected display. */
function boundsOnSomeDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(display => intersects(display.workArea, bounds))
}

/** Reads the persisted window state; falls back to the first-run default on any problem. */
export function restoreWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WindowState>
    const bounds = parsed.bounds ?? null
    if (
      bounds &&
      [bounds.x, bounds.y, bounds.width, bounds.height].every(n => Number.isFinite(n)) &&
      boundsOnSomeDisplay(bounds)
    ) {
      return { bounds, isMaximized: parsed.isMaximized === true }
    }
    return { bounds: null, isMaximized: parsed.isMaximized !== false }
  } catch {
    return DEFAULT_STATE
  }
}

/** Persists size/position (debounced while the user drags, final write on close). */
export function trackWindowState(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const write = () => {
    if (win.isDestroyed()) return
    const state: WindowState = {
      // getNormalBounds = the un-maximized rectangle even while maximized.
      bounds: win.getNormalBounds(),
      isMaximized: win.isMaximized(),
    }
    try {
      fs.writeFileSync(stateFilePath(), JSON.stringify(state))
    } catch {
      // Losing window-state persistence is not worth surfacing an error.
    }
  }

  const debouncedWrite = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(write, SAVE_DEBOUNCE_MS)
  }

  win.on('resize', debouncedWrite)
  win.on('move', debouncedWrite)
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    write()
  })
}
