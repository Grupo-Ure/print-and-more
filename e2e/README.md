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
│   ├─ fixtures/orders.ts          the orders view's page object + per-test rows + the catalog rows + a department default + a developer flag
│   ├─ fixtures/production.ts      the production page's page object (lists the products seeded above)
│   ├─ fixtures/stock.ts           the stock pages' page objects
│   ├─ fixtures/emails.ts          the sender's and the webhook's handles + a message queued and a sent record for the order seeded above
│   ├─ fixtures/approvals.ts       a customer approval request for the product seeded above
│   └─ <page>/<feature>/*.spec.ts  one folder per page, subfolders per feature: auth/, orders-page/order/, orders-page/product/, …
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
├─ orders-page/
   ├─ sidebar.spec.ts             list → select → details
   ├─ order/                      the order feature
   │   ├─ new-order.spec.ts
   │   ├─ header.spec.ts          what the header shows of the order and its customer, and the copy buttons
   │   ├─ settings.spec.ts
   │   ├─ status.spec.ts          the whole lifecycle: start, finish, invoice, cash close, reopen
   │   ├─ remove.spec.ts          archive, cancel, delete a quote
   │   └─ duplicate.spec.ts       the copy: a new quote, selected, with the products picked
   └─ product/                    the product feature — the unit of work
       ├─ add-remove.spec.ts      add through the department's form, delete in setup, cancel past setup
       ├─ basic-info.spec.ts      the spec read-only, edited in place, locked once released
       ├─ status.spec.ts          the workflow: pre-press, production, done
       ├─ release-gates.spec.ts   what refuses a release, and the admin override
       └─ stock-deduction.spec.ts what a release books against the stock pages
├─ production-page/
│  └─ feed.spec.ts                which products the feed lists, the assignee filter (and who it leaves out), the product detail beside it
├─ settings-page/
│  ├─ departments.spec.ts         the default assignee per department and stage
│  └─ emails.spec.ts              a mail's delay and on/off switch, as the next queued mail sees them
├─ email-runtime/
│  ├─ transport.spec.ts           what one drain of the email queue does: send and record, wait, refuse, give up
│  ├─ settings.spec.ts            what a template's settings change about a drain: the repeat, its maximum, a mail switched off
│  └─ webhook.spec.ts             what the provider's delivery reports do: delivered, bounced (the record, the history, the customer's address), a forged one refused
└─ customer-approval/
   ├─ requests.spec.ts            what asking, settling and withdrawing an approval request do in the database: the round, the product's status, the stock, the history, the mails, and what a waiting product refuses
   └─ function.spec.ts            what the customer's page can do through the customer-approval function with a link's token: read the request, download a proof, decide once; a closed request serves no file, an unknown token nothing
```

Later pages follow the same shape (`stamp-stock-page/`, `textile-stock-page/`,
`profile-page/`). `email-runtime/` and `customer-approval/` are the two
folders that are not a page: the email system has no screen of its own, and
the approval workflow's screens are still to come. Their specs drive the edge
functions and the database's own functions directly — the `send-email`,
`email-webhook` and `customer-approval` functions, the request RPCs as a
signed-in session — and read the outcome from the database. The customer's
approval page itself is tested in its own repository, `markus/customer-app`. A file is never split just because
it has several tests; it is split when it covers two sub-features. Inside a
file there is no `describe` for the feature — the path already names it — and
a `describe` block exists only to carry a precondition (`test.use({ … })`)
shared by the tests inside it. Playwright reports by file path, so every
folder level is a group in the list reporter, the HTML report and UI mode,
and any path fragment filters a run (`npx playwright test orders-page`,
`npx playwright test product/status`). The support folders (`fixtures/`,
`pom/`, `support/`) stay at the `e2e/` root; a spec reaches them with as many
`../` as it is deep. A new spec goes into the folder of the feature it drives,
never at the root.

## The fixture chain

Nothing assembles the fixtures in one place. Each fixture file imports the
previous file's `test` and extends it, so the chain is built by five import
lines:

```
@playwright/test → fixtures/database.ts → fixtures/electron.ts → fixtures/auth.ts → fixtures/orders.ts → fixtures/stock.ts
                                                                                                      ↘ fixtures/production.ts
                                                                                                      ↘ fixtures/emails.ts → fixtures/approvals.ts
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
  cleans up (an order, a product) belongs in a fixture: `create → await use()
  → delete`, so cleanup runs even when the test fails.
- **Setup and tests share nothing but the database.** Global setup returns
  nothing; specs find the credentials in `fixtures/users.ts`, which is the
  single source for them.
- **Fixtures seed data; they do not navigate.** A data fixture inserts rows
  and reloads the app; the spec gets to the order or product under test in its
  Setup stage through a page-object navigation helper
  (`ordersPage.openProduct`), and performs the actions it is about inline in
  Act. The auth state (`fixtures/auth.ts`) is the one fixture that drives the
  UI, being the prerequisite every test shares.
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
| `fixtures/auth.ts` | `user` option + signed-in `page`; `login` / `navbar` / `settingsPage` page objects; `signIn` / `signOut` helpers |
| `fixtures/users.ts` | The test logins, and which of them the `developer` fixture flags (data fixture) |
| `fixtures/orders.ts` | `ordersPage` page object + per-test data of the orders view: `customer` (a fresh customer), `order` (a fresh order for it), `product` (a fresh product in that order), `orderFile` (a file linked to it), `newCustomer` (data for a customer the test creates in the app), `departmentDefault` (one department's default assignee for one stage, emptied afterwards), `developer` (a login flagged as a developer account, unflagged afterwards) — each created/cleaned up around the test. The state `order` and `product` are inserted in comes from the `orderSeed` / `productSeed` options (`test.use({ orderSeed: IN_PROGRESS_ORDER })`); the defaults are an empty quote and an OTHER product in setup. `catalog` (automatic) keeps the stamp models and the textile chain the product seeds reference in the catalog, reset to their seed stock before every test |
| `fixtures/stock.ts` | `stampStockPage` / `textileStockPage` page objects, for reading stock after a release |
| `fixtures/production.ts` | `productionPage` page object; the products it lists come from the `order` / `product` / `products` fixtures of the orders link |
| `fixtures/emails.ts` | `sendEmail` (the runner's handle on the `send-email` function, one drain per call), `emailWebhook` (its handle on the `email-webhook` function, one signed delivery report per call), `queuedEmail` (a message queued for `order` through `queue_email` as `queuedEmailSeed` describes it; afterwards everything still queued for the order is archived, repeats included), `sentEmail` (a sent record for `order` as `sentEmailSeed` describes it, with a provider id of its own; removed with the order) and `emailSetting` (a template's row in Settings → Emails written over as `emailSettingSeed` describes it — switches, and wording where the seed gives one — and put back as it was afterwards; the row itself comes from the migration that adds the mail) |
| `fixtures/approvals.ts` | `approvalRequest` (one approval round for `product` over `orderFile`, as `approvalRequestSeed` describes it — open, in which case the product is put into awaiting approval as sending the request would have, or closed; it carries the link's raw token, whose hash the row stores; removed with the order), `approvalProof` (the round's file copy in the approval-proofs bucket; removed from the bucket afterwards), `customerApproval` (the runner's handle on the `customer-approval` function) and `approvalMailQueue` (automatic: every mail still queued for `order` is archived after the test, so a request mail or a decision's notice a test left waiting is not claimed by the next drain) |
| `fixtures/approvalRequests.ts` | The rounds the `approvalRequest` fixture inserts (open and mailed, open and unmailed, withdrawn), the message and the note a spec sends, the request statuses and history events a spec asserts against, and the helpers that mint a request id, build a file copy's storage path, read the token out of a sent request mail and hash it as the database does, and what the customer's page meets: the proof's stored bytes, a token no request has, the function's answer statuses (data fixture) |
| `fixtures/emailMessages.ts` | The messages the `queuedEmail` fixture queues (immediate, delayed, delayed by Settings, unknown template, no longer needed, refused by the dry-run transport), the sent record the `sentEmail` fixture inserts, the delivery reports a spec posts (delivered, bounced) and the secret a forged one is signed with, the Settings rows the `emailSetting` fixture writes (immediate, repeating, a subject with a slot for the order, a subject with a slot the data lacks), the wording a spec types into the wording dialog, every mail type the sender knows, and the sender's and the webhook's constants a spec asserts against (data fixture) |
| `fixtures/customers.ts` | The customers those fixtures use (data fixture) |
| `fixtures/departments.ts` | The department-default seeds the `departmentDefault` fixture applies: which department and stage, and who holds it (data fixture) |
| `fixtures/products.ts` | Product seeds (department, type, status, approval flag, and the children holding the spec), the form values a spec types, the expected product number, the force-release reason (data fixture) |
| `fixtures/files.ts` | The file the `orderFile` fixture links for the customer approval (data fixture) |
| `fixtures/stamps.ts` | The stamp models the `catalog` fixture keeps in the catalog: one out of stock for the gate, one in stock for the deduction (data fixture) |
| `fixtures/textiles.ts` | The textile brand → model → variant chain the `catalog` fixture keeps in the catalog, in stock for the deduction (data fixture) |
| `pom/*POM.ts` | Page objects — every locator a spec uses, one class per view/dialog, composed parent → child |
| `pom/BasePOM.ts` | Ancestor of every page object: holds the page and the shared helpers (`withAttr()` picks one instance of a repeated element by data attribute) |
| `support/testIds.ts` | The `TEST_IDS` registry, imported by components (`data-testid`) and page objects alike |
| `support/database.ts` | `TestDatabase`: the runner's service-role connection (bypasses RLS, exposes `auth.admin`) with the methods that seed and remove users, customers, orders and products, insert an approval round and read the rounds, a product's workflow columns, the stock and movements of a stamp model and the order's history entries back, and that queue, reschedule, archive and read back emails, insert a sent record and read what the provider reported of it, and write a template's email settings — raw rows only, no app business logic. `asUser(login)` hands out a second connection signed in as one of the suite's logins, for the rules the database enforces on the app but not on the runner |
| `support/sendEmail.ts` | `SendEmailFunction`: one drain of the email queue per call, the way the cron makes it (`drain()` with the service-role key, `drainAs(token)` with any other bearer token for the caller check) |
| `support/emailWebhook.ts` | `EmailWebhookFunction`: one delivery report per call, posted the way Resend posts it — signed with the function's secret (`report()`), or with another one for the signature check (`reportSignedWith(secret, report)`) |
| `support/customerApproval.ts` | `CustomerApprovalFunction`: the `customer-approval` function called the way the customer's page calls it — no session, the token only: `read(token)`, `download(token, fileId)`, `decide(token, decision, note)` |
| `TEST_PLAN.md` | The hand-written plan: which tests exist, by pack, precondition and ID. The source of truth the specs are held to by `scripts/test-plan.mjs` |
| `global-setup.ts`, `global-teardown.ts` | Run-wide data, wired via `playwright.config.ts` |

## Environment

The runner reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the same
ones the build inlines; the anon key is for `TestDatabase.asUser`, which writes
as a signed-in login) and `SUPABASE_SERVICE_ROLE_KEY` (runner only, never
`VITE_`-prefixed). Locally all three come from `.env`; for a local Supabase the
keys are in `supabase status`. In CI the job exports them from its own instance
and has no `.env`. The one variable the runner shares with an edge function,
`RESEND_WEBHOOK_SECRET`, is read from `supabase/functions/.env` — the file the
local `email-webhook` reads it from — so the reports the suite signs verify
against the function without the value being kept twice. The local functions
do not boot without that file (copy `supabase/functions/.env.example`;
`customer-approval` also needs its `CUSTOMER_APP_URL`), and neither do the
`email-runtime/` and `customer-approval/` specs.

[`TEST_PLAN.md`](TEST_PLAN.md) comes first: a test is planned there, numbered with `npm run test:plan:assign`, and then written with that ID in its title. `npm run test:plan:status` lists what is still to write; `npm run test:plan:check` (run in CI) fails on a spec test the plan does not name or that differs from it. The rules are in the testing standards under "The plan comes first".

Test conventions (fixtures files, minimal assertions, setup/act/assert/cleanup
stages) are in [`docs/testing/testing-standards.md`](../docs/testing/testing-standards.md);
how specs locate elements (test IDs, the `TEST_IDS` registry, page objects
under `pom/`) is in [`docs/testing/playwright-e2e.md`](../docs/testing/playwright-e2e.md).
