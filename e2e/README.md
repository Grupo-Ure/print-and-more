# End-to-end suite — how a run works

Playwright drives the **built Electron app** against a **local Supabase**.
`npm run test:e2e` builds first, then runs `playwright test`; CI does the same
against a `supabase start` instance on the runner (see
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). No hosted project
is ever involved.

## The map

```
npm run build                      renderer bundle, VITE_SUPABASE_URL baked in (from .env)
playwright test
├─ playwright.config.ts            loads .env into process.env (existing vars win)
├─ e2e/global-setup.ts             default() → create the test logins via the Auth admin API
├─ worker
│   ├─ fixtures/electron.ts        launch one app with a throwaway profile (per worker)
│   ├─ fixtures/auth.ts            bring the app into the auth state the spec asked for
│   └─ spec … spec … spec
└─ e2e/global-teardown.ts          default() → delete the test logins
```

## Who calls what

Nothing here is imported by hand; the runner drives it from the config:

| Stage | Where it is declared | Runs | Process |
|---|---|---|---|
| Load `.env` | top of `playwright.config.ts` | once | runner |
| `globalSetup` | `playwright.config.ts` → `e2e/global-setup.ts` (default export) | once, before any worker | runner |
| App launch | `electronApp` fixture, `scope: 'worker'` | once per worker | worker |
| Auth state | `page` fixture override in `fixtures/auth.ts` | before every test | worker |
| `globalTeardown` | `playwright.config.ts` → `e2e/global-teardown.ts` (default export) | once, after the last test | runner |

## Rules that follow from the map

- **Run-wide data goes in global setup; per-test data goes in fixtures.**
  Global setup runs once per `playwright test`, in the runner's main process,
  no matter how many specs or workers. Anything a single test creates and
  cleans up (an order, a job) belongs in a fixture: `create → await use() →
  delete`, so cleanup runs even when the test fails.
- **Setup and tests share nothing but the database.** Global setup returns
  nothing; specs find the credentials in `fixtures/users.ts`, which is the
  single source for them.
- **Setup is idempotent.** `globalTeardown` is skipped when a run is killed
  hard (Ctrl-C), so `ensureTestUser` looks before it creates — a leftover
  login from an aborted run does not break the next one.
- **The session persists within a worker.** One app window serves every test
  of a worker, and Supabase keeps the session in the profile's web storage.
  The `auth` fixture therefore checks the navbar greeting first and only
  signs out/in when the spec asks for a different user (`test.use({ user })`)
  or a signed-out app (`user: null`).

## Where things live

| Path | Role |
|---|---|
| `fixtures/electron.ts` | Launches the built app; replaces Playwright's browser `page` |
| `fixtures/auth.ts` | `user` option + signed-in `page`; `signIn` / `signOut` helpers |
| `fixtures/users.ts` | The test logins (data fixture) |
| `pom/*POM.ts` | Page objects — every locator a spec uses, one class per view/dialog, composed parent → child |
| `pom/BasePOM.ts` | Ancestor of every page object: holds the page and the shared helpers (`withAttr()` picks one instance of a repeated element by data attribute) |
| `support/testIds.ts` | The `TEST_IDS` registry, imported by components (`data-testid`) and page objects alike |
| `support/admin.ts` | Service-role client for the runner — bypasses RLS, exposes `auth.admin` |
| `support/users.ts` | Create / remove a test login through that client |
| `global-setup.ts`, `global-teardown.ts` | Run-wide data, wired via `playwright.config.ts` |

## Environment

The runner reads `VITE_SUPABASE_URL` (the same one the build inlines) and
`SUPABASE_SERVICE_ROLE_KEY` (runner only, never `VITE_`-prefixed). Locally both
come from `.env`; for a local Supabase the key is in `supabase status`. In CI
the job exports them from its own instance and has no `.env`.

Test conventions (fixtures files, minimal assertions, setup/assert/cleanup
stages) are in [`docs/testing/testing-standards.md`](../docs/testing/testing-standards.md);
how specs locate elements (test IDs, the `TEST_IDS` registry, page objects
under `pom/`) is in [`docs/testing/playwright-e2e.md`](../docs/testing/playwright-e2e.md).
