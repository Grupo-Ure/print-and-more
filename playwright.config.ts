import fs from 'node:fs'
import { defineConfig } from '@playwright/test'

// The runner provisions test data against the same Supabase the build was
// made for, so it reads the same .env (VITE_SUPABASE_URL plus the runner-only
// SUPABASE_SERVICE_ROLE_KEY). Variables already in the environment win — CI
// exports them from its local instance and has no .env.
if (fs.existsSync('.env')) process.loadEnvFile('.env')

// E2E tests drive the built Electron app (dist/ + dist-electron/), never the
// Vite dev server — `npm run test:e2e` builds first. The browser projects
// Playwright normally defines do not apply: the fixture in e2e/fixtures owns
// the launch.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // One Electron app and one local Supabase per run; parallel workers would
  // race on the same database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
