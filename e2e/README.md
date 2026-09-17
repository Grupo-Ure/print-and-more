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
│   ├─ fixtures/orders.ts          the orders view's page object + per-test rows + the catalog rows
│   ├─ fixtures/stock.ts           the stock pages' page objects
│   └─ <page>/<feature>/*.spec.ts  one folder per page, subfolders per feature: auth/, orders-page/order/status/, …
└─ e2e/global-teardown.ts          default() → delete the test logins
```

## Where specs live

Specs are grouped **by page, then by feature**, and **one file holds every
test of one sub-feature**. The top folder is the page, suffixed `-page` so
that a page and a feature of the same name never collide (`orders-page/` is
the page; `orders-page/order/` is the order feature on it). Inside, a folder
per feature, and a file per sub-feature:

```
e2e/
├─ auth/                          sign-in, navigation per role
└─ orders-page/
   ├─ sidebar.spec.ts             list → select → details
   ├─ order/                      the order feature
   │   ├─ new-order.spec.ts
   │   ├─ settings.spec.ts
   │   └─ status.spec.ts          the whole lifecycle: start, finish, invoice, cash close, …
   └─ job/                        the job feature
       ├─ add-job.spec.ts
       ├─ products.spec.ts
       ├─ status.spec.ts          the workflow: pre-press, production, done
       ├─ release-gates.spec.ts   what refuses a release, and the admin override
       └─ stock-deduction.spec.ts what a release books against the stock pages
```

Later pages follow the same shape (`stamp-stock-page/`, `textile-stock-page/`,
`user-management-page/`, `profile-page/`). A file is never split just because
it has several tests; it is split when it covers two sub-features. Inside a
file there is no `describe` for the feature — the path already names it — and
a `describe` block exists only to carry a precondition (`test.use({ … })`)
shared by the tests inside it. Playwright reports by file path, so every
folder level is a group in the list reporter, the HTML report and UI mode,
and any path fragment filters a run (`npx playwright test orders-page`,
`npx playwright test job/status`). The support folders (`fixtures/`, `pom/`,
`support/`) stay at the `e2e/` root; a spec reaches them with as many `../`
as it is deep. A new spec goes into the folder of the feature it drives,
never at the root.

## The fixture chain

Nothing assembles the fixtures in one place. Each fixture file imports the
previous file's `test` and extends it, so the chain is built by five import
lines:

```
@playwright/test → fixtures/database.ts → fixtures/electron.ts → fixtures/auth.ts → fixtures/orders.ts → fixtures/stock.ts
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
- **Fixtures seed data; they do not navigate.** A data fixture inserts rows
  and reloads the app; the spec itself clicks its way to the order or job
  under test, in its Act stage. The auth state (`fixtures/auth.ts`) is the
  one fixture that drives the UI, being the prerequisite every test shares.
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
| `<page>/<feature>/*.spec.ts` | The specs: a folder per page, subfolders per feature (see "Where specs live") |
| `fixtures/database.ts` | Base of the chain: the worker-scoped `database` connection |
| `fixtures/electron.ts` | Launches the built app; replaces Playwright's browser `page` |
| `fixtures/auth.ts` | `user` option + signed-in `page`; `login` / `navbar` page objects; `signIn` / `signOut` helpers |
| `fixtures/users.ts` | The test logins (data fixture) |
| `fixtures/orders.ts` | `ordersPage` page object + per-test data of the orders view: `customer` (a fresh customer), `order` (a fresh order for it), `job` (a fresh job in that order), `orderFile` (a file linked to it), `newCustomer` (data for a customer the test creates in the app) — each created/cleaned up around the test. The state `order` and `job` are inserted in comes from the `orderSeed` / `jobSeed` options (`test.use({ orderSeed: IN_PROGRESS_ORDER })`); the defaults are an empty quote and an empty job. `catalog` (automatic) keeps the stamp models and the textile chain the product seeds reference in the catalog, reset to their seed stock before every test |
| `fixtures/stock.ts` | `stampStockPage` / `textileStockPage` page objects, for reading stock after a release |
| `fixtures/customers.ts` | The customers those fixtures use (data fixture) |
| `fixtures/jobs.ts` | Job seeds (department, status, approval flag, optional product rows), product form values, the expected job number, the force-release reason (data fixture) |
| `fixtures/files.ts` | The file the `orderFile` fixture links for the customer approval (data fixture) |
| `fixtures/stamps.ts` | The stamp models the `catalog` fixture keeps in the catalog: one out of stock for the gate, one in stock for the deduction (data fixture) |
| `fixtures/textiles.ts` | The textile brand → product → variant chain the `catalog` fixture keeps in the catalog, in stock for the deduction (data fixture) |
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

Test conventions (fixtures files, minimal assertions, setup/act/assert/cleanup
stages) are in [`docs/testing/testing-standards.md`](../docs/testing/testing-standards.md);
how specs locate elements (test IDs, the `TEST_IDS` registry, page objects
under `pom/`) is in [`docs/testing/playwright-e2e.md`](../docs/testing/playwright-e2e.md).
