import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test'

// The `electron` package resolves to the path of the Electron binary.
const electronBinary = createRequire(import.meta.url)('electron') as string
const projectRoot = path.resolve(import.meta.dirname, '../..')

type WorkerFixtures = {
  /** One launched app per worker, closed when the worker ends. */
  electronApp: ElectronApplication
}

type TestFixtures = {
  /** The app's main window (replaces Playwright's browser `page`). */
  page: Page
}

/** process.env without the undefined entries Playwright's launch() rejects. */
function launchEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) env[key] = value
  }
  // VS Code terminals export this; it turns the Electron binary into a
  // plain Node runtime and the launch never produces a window.
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  electronApp: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
    async ({}, use) => {
      // Fresh profile per worker: web storage (and with it the Supabase
      // session) never leaks between runs or into the developer's own profile.
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pam-e2e-'))
      const env = launchEnv()

      const args = [projectRoot, `--user-data-dir=${userDataDir}`]
      // Chromium refuses to start its sandbox as root (typical for WSL setups).
      if (process.getuid?.() === 0) args.push('--no-sandbox')

      const app = await electron.launch({ executablePath: electronBinary, args, cwd: projectRoot, env })
      await use(app)
      await app.close()
      fs.rmSync(userDataDir, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

export { expect } from '@playwright/test'
