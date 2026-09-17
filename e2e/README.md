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
│   ├─ fixtures/database.ts        one database connection for seeding (per worker)
│   ├─ fixtures/electron.ts        launch one app with a throwaway profile (per worker)
│   ├─ fixtures/auth.ts            bring the app into the auth state the spec asked for
│   ├─ fixtures/orders.ts          the orders view's page object + per-test rows
│   └─ spec … spec … spec
└─ e2e/global-teardown.ts          default() → delete the test logins
```

## The fixture chain

Nothing assembles the fixtures in one place. Each fixture file imports the
previous file's `test` and extends it, so the chain is built by four import
lines:

```
@playwright/test → fixtures/database.ts → fixtures/electron.ts → fixtures/auth.ts → fixtures/orders.ts
```

A spec imports `test` from the link it needs — `./fixtures/auth` for a
session-level test, `./fixtures/orders` for anything on the orders view — and
gets every fixture of that link and of all the links below it. A new fixture
is declared once, in the lowest link that can provide it, and inherited by
everything above.

Page objects are fixtures too (`login`, `navbar`, `ordersPage`): a spec takes
them from its arguments and never constructs one itself.

## Who calls what

Nothing here is imported by hand; the runner drives it from the config:

| Stage | Where it is declared | Runs | Process |
|---|---|---|---|
| Load `.env` | top of `playwright.config.ts` | once | runner |
| `globalSetup` | `playwright.config.ts` → `e2e/global-setup.ts` (default export) | once, before any worker | runner |
| Database connection | `database` fixture, `scope: 'worker'` | once per worker, on first use | worker |
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
| `fixtures/database.ts` | Base of the chain: the worker-scoped `database` connection |
| `fixtures/electron.ts` | Launches the built app; replaces Playwright's browser `page` |
| `fixtures/auth.ts` | `user` option + signed-in `page`; `login` / `navbar` page objects; `signIn` / `signOut` helpers |
| `fixtures/users.ts` | The test logins (data fixture) |
| `fixtures/orders.ts` | `ordersPage` page object + per-test data of the orders view: `customer` (a fresh customer), `order` (a fresh quote for it), `newCustomer` (data for a customer the test creates in the app) — each created/cleaned up around the test |
| `fixtures/customers.ts` | The customers those fixtures use (data fixture) |
| `pom/*POM.ts` | Page objects — every locator a spec uses, one class per view/dialog, composed parent → child |
| `pom/BasePOM.ts` | Ancestor of every page object: holds the page and the shared helpers (`withAttr()` picks one instance of a repeated element by data attribute) |
| `support/testIds.ts` | The `TEST_IDS` registry, imported by components (`data-testid`) and page objects alike |
| `support/database.ts` | `TestDatabase`: the runner's service-role connection (bypasses RLS, exposes `auth.admin`) with the methods that seed and remove users, customers and orders — raw rows only, no app business logic |
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
