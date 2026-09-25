# Auftragssystem — Order Intake & Production Control

Internal desktop tool for a print and advertising shop (product name in the
app: **Print And More**). Used by a small team to manage customer orders
across multiple production departments: order intake, status tracking
through the production workflow, inventory, customer approvals, time
logging, history logging, and ERP export.

This file describes **architecture, domain model, and workflows** — the stable
properties of the application. Open work and known gaps are tracked in Jira,
not here. The authoritative source for library versions is `package.json`; the
authoritative source for UI dimensions is the relevant CSS file.

**[DOCS.md](DOCS.md) is the entry point into the [docs/](docs/) folder.** It is
the main file to consult whenever you need to know the architectural patterns
we follow or should follow — coding standards, per-role skill docs, and
reference material. Read it (and the docs it links) before making changes.

> This file is the project's `CLAUDE.md` and doubles as its README — the
> conventions below apply to AI assistants working in this repo as well as
> to human contributors.

## Working with this project

**The app is in production.** The shop works in it daily against the hosted
Supabase project, which holds real orders, customers and stock. Treat the
database as live:

- **Every schema change is a new migration** under `supabase/migrations/`
  (`supabase migration new <name>`): tables, columns, enum values, check
  constraints, RLS policies, triggers, functions, and changes to catalog
  master data alike. Nothing is changed by hand in the Supabase dashboard or
  SQL editor, and nothing is changed by editing an existing migration file.
- **Applied migrations are frozen.** The dated base files (types, core,
  orders, jobs, …) are the schema as it went live; a correction is a new
  migration on top, never an edit of the file that is already applied.
- `supabase/seed.sql` only feeds fresh databases (local, CI). A change to
  master data that production must also see needs a migration as well.
- A migration is verified against a local Supabase (`supabase db reset`
  replays every migration plus the seed) and the e2e suite before it is
  pushed. After it lands, regenerate `src/types/supabase.ts` — the product
  schemas' drift assertions will not compile until the types match.
- No destructive change (drop, rename, type change of a populated column)
  without a data-preserving path in the same migration.

The Supabase CLI workflow and the migration rules are spelled out in
[docs/coding-standards.md](docs/coding-standards.md) ("Migrations").

Releases follow [docs/releasing.md](docs/releasing.md); the GitHub release
body is generated from the user-facing sections of the PRs it ships.

**Language — the repo is being Anglicized; English is the target.**

The goal is to remove German from the codebase. German is legacy, not a
convention to preserve. Do **not** introduce or re-introduce German
identifiers, names, or strings.

- All prose (docs, comments, commit messages, PRs) is **English**.
- **Code is English** — table/column names, enum types, function/RPC names,
  TypeScript identifiers, file names. When you touch code with leftover German,
  translate it; don't preserve it "to match the source."
- **Authoritative rename maps** (use these; don't invent parallel names):
  [.plans/DB_RENAME_MAP.md](.plans/DB_RENAME_MAP.md) (schema identifiers, enum
  types, enum/check values, functions) and [.plans/I18N_MAP.md](.plans/I18N_MAP.md)
  (UI display strings → i18next).
- **Known remaining German** (deferred, tracked — not "the convention"):
  1. **Stored enum VALUE strings** inside product specs (e.g. binding colour
     `'SCHWARZ'`, fold `'MITTELFALZ'`, the material list in
     `src/config/materialien.ts`). Columns are plain `text`; UI labels already
     show English. Deferred to a shop-confirmed value-rename pass.
  2. **UI display strings** still hardcoded in components — the i18next pass
     ([I18N_MAP.md](.plans/I18N_MAP.md)) is not yet done.
- The product name **"Auftragssystem"** is a proper noun (repo/product name) and
  is left as-is.

**Issue tracking** — work is tracked in **Jira**, project **Print And More**
(issue key prefix `MKS`). When asked about tasks/tickets, look there first.

**Where things go**
- **CLAUDE.md** (this file) — stable architecture, domain model, workflows. No
  version pins, no pixel widths, no status or to-do lists (those live in Jira).
- **[DOCS.md](DOCS.md)** — documentation index; entry point to
  [docs/](docs/) (coding standards, skill docs, reference). Consult it for the
  architectural patterns to follow.
- **[.plans/electron_porting.md](.plans/electron_porting.md)** /
  **[.plans/electron_workplan.md](.plans/electron_workplan.md)** — design
  decisions and work packages of the (completed) Electron port, kept for
  reference.
- **`package.json`** = library versions; CSS files = UI dimensions. Don't
  duplicate those into prose.

## Tech Stack

- **Frontend:** React + TypeScript + Vite; TanStack Query for server state
  (`src/queries/*`), TanStack Form + Zod for product forms.
- **Styling:** Tailwind CSS + CSS variables (colour system in `index.css`);
  shadcn-style primitives vendored under `src/components/ui/*`.
- **Backend:** Supabase — PostgreSQL with Auth and Row-Level Security; RLS
  policies and triggers live in the migrations. The base schema is split into
  domain migration files under `supabase/migrations/` (types, core, orders,
  jobs, catalog, products_core, one file per department's product tables,
  blueprint, audit, duplicate_order); everything since went live is a dated
  migration after them, and that is the only way the schema changes (see
  "The app is in production" above). `supabase/seed.sql` holds catalog
  master data; `seed.dev.sql` (git-ignored) holds local demo data. One edge
  function, `manage-users`, exists for what the browser cannot do
  (create/delete auth accounts).
- **Client:** [src/supabase.ts](src/supabase.ts) (`createClient`); generated
  types in [src/types/supabase.ts](src/types/supabase.ts), app-facing aliases
  in [src/types/database.ts](src/types/database.ts).
- **Service layer:** DB access goes through `src/services/*`; components read
  and mutate through the hooks in `src/queries/*`, never `supabase` directly
  (PDF generation is the one remaining exception).
- **Desktop shell:** **Electron** (`electron/` — main, preload, IPC, custom
  app protocol, deep links, window state, Sentry). The renderer is the Vite
  bundle; the preload exposes a small typed bridge as `window.pam`
  ([src/types/electron-api.d.ts](src/types/electron-api.d.ts)): reveal a path
  in the file manager, pick files, open external URLs, and deep-link
  callbacks. The app must still run in a plain browser tab for development;
  code that needs the bridge checks for `window.pam` and degrades with a
  toast.
- **Deep links:** the `pam://` scheme. `pam://order/<uuid>` opens that order
  (parked in main until the renderer has a session); `pam://auth/…` completes
  the Google OAuth PKCE flow that runs in the system browser.
- **Target platform:** desktop only. No mobile/touch support, but **small
  laptops (~1075px wide) must be usable**; see "Responsive layout" below.
- **Testing:** Playwright end-to-end tests under `e2e/` drive the built
  Electron app against a local Supabase (`npm run test:e2e`). The fixture in
  `e2e/fixtures/electron.ts` launches one app per worker with a throwaway
  profile.

## UI Layout

[`App.tsx`](src/App.tsx) mounts the providers (toast, confirm, forced password
change), the top [`AppNavbar`](src/components/AppNavbar.tsx), and the active
view. There is **no router**: the view and the active order/job selection
live in [`navigation.context.tsx`](src/context/navigation.context.tsx)
(`AppView`: `orders`, `production`, `stampStock`, `textileStock`, `settings`,
`profile`). Orders and production are for everyone; the stock views and
settings are admin-only, and the user-management section inside settings is
super-admin only.

### The orders view

[`OrderWorkspace`](src/pages/OrderWorkspace.tsx) renders the login layout
without a session, otherwise a two-column shell:

| Column | Component | Role |
|--------|-----------|------|
| Left   | [`OrderSidebar`](src/components/OrderSidebar.tsx) | Search + filters (status, department, deadline/intake ranges), order list with selection, per-order menu (duplicate / delete quote), "+ New Order" ([`NewOrderDialog`](src/components/NewOrderDialog.tsx)). Archived orders are listed only while the header's *Show archived* toggle is on, except billed ones, which appear whenever Billed is ticked; the default status filter ticks every status, so completed orders stay in the feed. There is no assignee filter here — finding one's own work is the production view's job. |
| Centre | [`OrderDetails`](src/components/OrderDetails.tsx) | Order header (number, customer, lifecycle button, files/history/archive/cancel actions), order settings row (deadline, delivery, priority, payment), then [`JobList`](src/components/JobList.tsx) (add-job buttons, one row per job with status track and right-click menu) next to the active job's [`JobDetail`](src/components/JobDetail.tsx). |

`JobDetail` shows the job header (assignee, status badge, settings / time
logs / PDF / delete-or-cancel actions, the
[`JobReleaseButton`](src/components/JobReleaseButton.tsx)), the
[`JobProductionBanner`](src/components/JobProductionBanner.tsx) naming unmet
release requirements, and the department's product section. Job settings
(separate deadline/delivery/priority overrides, customer approval) and time
logs open as dialogs from that header
([`src/components/jobDetail/`](src/components/jobDetail/)). The
former right-hand `ContextPanel` is gone; every workflow action now lives in
the header of the order or the job (or the job list's context menu). The
invisible [`StatusManager`](src/components/StatusManager.tsx) mounted in
`OrderDetails` runs the automatic status logic (see "Status").

### Row flags and due dates

The order sidebar, the job list and the production feed share their row
markers. [`Flags.tsx`](src/components/Flags.tsx) holds the red icon flags,
all the same colour and told apart by shape: *missing information*
(`isMissingInfo`), *deadline missed* (`isDeadlineMissed`) and *high
priority* (effective priority for a job). An order row carries a job flag
when any of its jobs does. [`DueDate`](src/components/DueDate.tsx) renders a
row's deadline as "Due today" (red), "Due tomorrow" (orange) or "Due Sep
28th" (`formatDateHuman` in [src/lib/formatDate.ts](src/lib/formatDate.ts)),
with the exact date in the tooltip.

### The production view

[`ProductionPage`](src/pages/ProductionPage.tsx) is the back office's view
of the work: the same two-column shell as the orders view, with
[`ProductionSidebar`](src/components/production/ProductionSidebar.tsx)
listing **jobs across all orders** — every non-cancelled job in `PREPRESS`
or `IN_PRODUCTION` on a non-archived order (`jobService.listProductionJobs`,
`useProductionJobs`), `HIGH` priority first regardless of date, then
soonest effective deadline first. A row shows department, customer, job number, effective
deadline (as a relative due date, see "Row flags and due dates"), status and
assignee. The header's assignee filter is the job
header's `EmployeeCombobox` (one user or *Everyone*) with a caption stating
what the feed shows; every user, admins included, starts on their own
jobs. Selecting a row (`selectJob` in the navigation context) shows
the job in [`ProductionJobPanel`](src/components/production/ProductionJobPanel.tsx):
a read-only strip naming the order (customer, number, deadline, status, an
*Open in orders* button) above the same `JobDetail` the orders view uses,
edited in place, with the order's `StatusManager` mounted alongside. The
selection is the app-wide one, so the order stays selected when switching
to the orders view. Order-level actions (lifecycle, settings, files dialog)
remain on the orders view.

### Responsive layout — one breakpoint, two strategies

The app has exactly **one breakpoint** and two layouts: *compact* (small
laptops) and *desktop*. It is defined once as `--breakpoint-desktop` in the
`@theme` block of `src/index.css` and consumed two ways:

- **CSS / Tailwind:** base styles are the compact variant; apply the
  `desktop:` variant for the roomier layout (mobile-first). Don't introduce
  other breakpoints — `sm:`/`md:`/`lg:` should only appear inside vendored
  `src/components/ui/*` code.
- **TypeScript:** `useIsMobile()` (`src/hooks/use-mobile.ts`) returns `true`
  below the same width — it reads `--breakpoint-desktop` at runtime, so the
  hook and the variant can never drift apart.

Column widths are **fixed per breakpoint** (never content-driven): the order
sidebar and the job list are fixed-width columns that are simply narrower in
compact mode (`--sidebar-width` is set in `OrderWorkspace`). The shadcn
sidebar is pinned to desktop mode (no mobile Sheet overlay) since this is a
desktop-only app. In compact mode the sidebar's search and filters collapse
behind icon toggles.

Styling lives in Tailwind utilities on the components, with one deliberate
exception: **global element typography** (`h1`/`h2`/`h3`/`p` via `@apply` in
`src/index.css`) sets the app-wide type scale — original sizes at `desktop:`,
one step smaller below. Utility classes on a tag override it per site.
Legacy plain-CSS rules (remnants from before Tailwind was introduced) are
being eliminated — don't add new ones, and when you touch code that depends
on one, replace it with utilities.

### Dialogs and confirmations

**Global dialogs:** [`NewOrderDialog`](src/components/NewOrderDialog.tsx),
[`CustomerDialog`](src/components/CustomerDialog.tsx) (opened through
`useOrderWorkspace().openCustomerDialog`, mounted once by
[`order.context.tsx`](src/context/order.context.tsx)),
[`DuplicateDialog`](src/components/DuplicateDialog.tsx),
[`OrderFilesDialog`](src/components/OrderFilesDialog.tsx) (order-wide file
links), [`OrderHistoryDialog`](src/components/OrderHistoryDialog.tsx).
Simple confirmations (archive/cancel/delete/mark-done/release prompts) go
through the promise-based `useConfirm()` hook from
[`ConfirmDialog`](src/components/ConfirmDialog.tsx) (`ConfirmProvider` is
mounted in `App.tsx`) — don't use `window.confirm` or one-off confirm dialogs.
Errors surface as toasts (`useToast()` from
[`Toast.tsx`](src/components/Toast.tsx)).

### Auth and roles

[`Login`](src/components/Login.tsx) offers email/password
(`signInWithPassword`) and Google sign-in; on desktop the OAuth flow runs in
the system browser and returns through the `pam://auth` deep link
([`authService`](src/services/authService.ts)). Without a session the app
renders only the login layout; a user flagged for a forced password change
gets [`ChangePasswordDialog`](src/components/ChangePasswordDialog.tsx) first.

Roles (`user_role` enum, table `users`): `EMPLOYEE`, `ADMIN`, `SUPER_ADMIN`
(hierarchical — `useIsAdmin()` in [`userQueries`](src/queries/userQueries.ts)).
Admin-only actions in the orders view: force-release a job, reopen a
finished order, log time on someone else's behalf or delete a time log.
Anyone may assign or reassign a job. Account creation/deletion goes through
the `manage-users` edge function; role changes are plain updates on `users`,
guarded by RLS and a trigger. DB triggers backstop every role rule — the UI
only hides what the DB would reject anyway.

**Developer accounts.** A super admin who signs in to the shop's database to
debug should never be handed work. The user-management section has a
*Developer* switch per account (`users.is_developer`, changeable by super
admins only, a super admin row only by the account itself); the
`EmployeeCombobox` leaves flagged accounts out of every picker (job
assignee, production filter, time logs, department defaults) unless one
already holds the value shown. The flag is per database, so a local
database simply leaves it off.

**Job assignment.** A job starts unassigned; whoever intakes the order
usually does not work its jobs. Each department can name a default assignee
per stage (`department_default_assignees`, one user for `PREPRESS` and one
for `IN_PRODUCTION`, set on the settings page). The moment a job enters one
of those statuses — by automatic promotion, manual release, force release,
or going back to pre-press — the `fn_assign_stage_default_assignee`
BEFORE UPDATE trigger hands it to that stage's default, whoever held it
before, and writes `ASSIGNEE_CHANGED` history with `meta.automatic`;
without a default the assignee stays. Reassigning by hand writes
`ASSIGNEE_CHANGED` as well.

### Full-page views

`StampStockPage` ([src/pages/StampStockPage.tsx](src/pages/StampStockPage.tsx))
— stamp models, ink colours, stock bookings and movements;
`TextileStockPage` ([src/pages/TextileStockPage.tsx](src/pages/TextileStockPage.tsx))
— textile master data (brand → product → variant) and variant stock;
`SettingsPage` ([src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx)) —
a fixed, always-visible section list on the left and the active section on
the right: *User management* (super admins;
[`UserManagementSettings`](src/components/settings/UserManagementSettings.tsx))
and *Departments* (admins; [`DepartmentSettings`](src/components/settings/DepartmentSettings.tsx),
the default assignee per department); `ProfilePage`. Shared stock UI
(booking fields, movement views, reorder list) lives in
[`src/components/stock/`](src/components/stock/).

## Production Departments (`department` enum)

Every order has 0…n jobs, each assigned to one production department.
Enum `department`: `LFP`, `COPYSHOP`, `TEXTILE`, `STAMP`, `LASER_ENGRAVING`,
`OTHER` (display labels and job-number abbreviations in
[`src/const/departmentAbbreviation.ts`](src/const/departmentAbbreviation.ts)).
Each department has a product section component, a set of per-type forms, and
per-type Zod schemas:

| Department | Products section | Forms | Schemas |
|---------|-----------|-------|---------|
| LFP (large format) | [`LfpProducts.tsx`](src/components/products/departments/LfpProducts.tsx) | [`forms/lfp.tsx`](src/components/products/forms/lfp.tsx) | [`schemas/lfp.ts`](src/lib/products/schemas/lfp.ts) |
| CopyShop | [`CopyShopProducts.tsx`](src/components/products/departments/CopyShopProducts.tsx) | [`forms/copyshop.tsx`](src/components/products/forms/copyshop.tsx) | [`schemas/copyshop.ts`](src/lib/products/schemas/copyshop.ts) |
| Textile | [`TextileProducts.tsx`](src/components/products/departments/TextileProducts.tsx) | [`forms/textile.tsx`](src/components/products/forms/textile.tsx) | [`schemas/textile.ts`](src/lib/products/schemas/textile.ts) |
| Stamp | [`StampProducts.tsx`](src/components/products/departments/StampProducts.tsx) | [`forms/stamp.tsx`](src/components/products/forms/stamp.tsx) | [`schemas/stamp.ts`](src/lib/products/schemas/stamp.ts) |
| Laser | [`LaserProducts.tsx`](src/components/products/departments/LaserProducts.tsx) | [`forms/laser.tsx`](src/components/products/forms/laser.tsx) | [`schemas/laser.ts`](src/lib/products/schemas/laser.ts) |
| Other | [`OtherProducts.tsx`](src/components/products/departments/OtherProducts.tsx) | [`forms/other.tsx`](src/components/products/forms/other.tsx) | [`schemas/other.ts`](src/lib/products/schemas/other.ts) |

All six compose the same plumbing: [`useProductEditor`](src/components/products/useProductEditor.ts)
(queries, add/edit/view mode machine, delete, read-only gating by job status),
[`ProductDialog`](src/components/products/ProductDialog.tsx) (type picker →
per-type form), and the tables in [`ProductTable.tsx`](src/components/products/ProductTable.tsx).

## Domain Model

- **Customer** — table `customers` (`name`, `email`, `phone`, `note`, address
  fields, `is_archived`). Created/edited via `CustomerDialog`; searched by
  `ilike` on `name` (only `is_archived = false`). A customer needs a name plus
  email or phone before a job may auto-advance to pre-press
  (`customerMeetsPrepressContact` in [src/lib/customer.ts](src/lib/customer.ts)).
- **Order** — table `orders` (`order_number` from a DB counter, `customer_id`,
  `status`, `deadline`, `delivery` (`PICKUP`|`SHIPPING`), `priority`
  (`NORMAL`|`HIGH`), `payment_method` (`INVOICE`|`CASH`), `billing_note`,
  `is_erp_exported`, `is_archived`, `created_by`, `created_at`). The header
  fields save on change, one field per save, each logged as a
  `SETTINGS_CHANGED` history entry.
- **Job** — table `jobs` (the per-department production unit). Carries
  `job_number` (`<order_number>-<DEPT>-<NN>`, assigned by a DB trigger, never
  by the client), `department`, `type` (legacy discriminator, nullable),
  `status`, `sort_order`, `deadline` / `delivery` / `priority` (**nullable =
  inherit from the order**; `resolveEffectiveJob` in
  [src/lib/jobShared.ts](src/lib/jobShared.ts) resolves the effective values),
  `assignee_id`, `is_cancelled`, and the customer-approval fields
  (`customer_approval_required` / `_granted` / `_file_id`).
- **Time logs** — table `job_time_logs`: worked-time entries per job
  (`minutes` > 0, `created_at`). `user_id` = the employee the time is
  attributed to; `created_by` = who wrote the row. Employees log as
  themselves; only admins may log on someone else's behalf or delete a log
  (RLS-enforced). The job's total time is `SUM(minutes)` over its logs —
  there is no aggregate column. Every create/delete writes a history event
  (`TIME_LOGGED` / `TIME_LOG_DELETED`). UI:
  [`JobTimeLogs`](src/components/JobTimeLogs.tsx) inside the job's time-logs
  dialog; service [`timeLogService`](src/services/timeLogService.ts).
- **Files** — table `files` (`order_id`, `display_name`, `path`, `role`
  (`PRODUCTION_FILE` | `PREVIEW` | `CUSTOMER_APPROVAL` | `REFERENCE`)).
  Attached at the **order** level via `OrderFilesDialog` (drop or pick files;
  the desktop bridge resolves the real path); products link to them through
  `product_files`; a customer approval is granted against one of them.
  UNC-path **linking**, not upload — the files stay on the network share, and
  "open" reveals them through `window.pam.revealPath`.
- **History** — table `history` (`order_id`, `job_id`, `event_type`
  (`history_event` enum), `user_id`, `meta`). Written alongside every
  workflow action by [`historyService`](src/services/historyService.ts);
  shown in `OrderHistoryDialog`.
- **Products** — see below (the typed per-type model).
- **Textile master data** — `textile_brands` → `textile_products` →
  `textile_variants` (`color`, `color_hex`, `size`, `stock`, `min_stock`),
  `textile_stock_movements`. Per-order textile data is in the product
  hierarchy: a `TEXTILE_GARMENT` product (`origin` `OWN_STOCK` with a catalog
  `variant_id` or free-text brand/model/colour/size, or `CUSTOMER_STOCK`),
  its design applications as `textile_motif_links` referencing the order's
  `textile_motifs`.
- **Stamp master data** — `stamp_models`, `stamp_ink_colors`,
  `stamp_stock_movements`.
- **Users** — table `users` (`name`, `email`, `role`, `avatar_url`,
  `is_developer`), mirrored from Supabase Auth. `is_developer` marks a
  developer account (someone debugging against the shop's database): it is
  left out of every assignee picker and grants nothing.
- **Department defaults** — table `department_default_assignees`
  (PK `(department, status)` with `status` limited to `PREPRESS` /
  `IN_PRODUCTION`, `user_id` → `users`, cascade on delete): the user a job
  of that department is handed to when it enters that stage. Readable by
  all, admin-writable; service
  [`departmentSettingsService`](src/services/departmentSettingsService.ts).
- **Blueprint** — `blueprint_*` tables exist in the schema (a separate
  blueprint-copying feature) but nothing in the client uses them yet.

### Products — typed per-type tables

The model is supertype/subtype (class-table inheritance):

- **Parent `department_products`** — `id`, `job_id`, `department`,
  `type` (discriminator), `quantity`, `notes`, `sort_order`, `created_at`.
- **One typed child table per product type** (31 total: 7 CopyShop, 9 Stamp,
  8 LFP, 5 Laser, 1 Other, 1 Textile), PK = FK to `department_products`
  (`department_product_id`), holding that type's English spec columns. The
  `type` value selects the child (e.g. `POSTER` → `poster_products`,
  `TRODAT_PRINTY` → `trodat_printy_products`, `TEXTILE_GARMENT` →
  `textile_garment_products`).
- **`product_files`** — M:N file links on the parent (`department_product_id` →
  `department_products`, `file_id` → `files`).

**Code contract:** [src/types/product.ts](src/types/product.ts) defines
`LoadedProduct` (parent + typed `child`), `ProductWriteInput`, the `ChildTable`
union, `CHILD_TABLE_BY_TYPE` / `childTableForType()`.
[`departmentProductService`](src/services/departmentProductService.ts) is the only
product service: `getProductsByJobId` (parent + child), `createProduct` /
`updateProduct` (TS two-step — insert/update parent then child, no RPC),
`deleteProduct` (cascade), the `product_files` helpers, and the textile motif
links. Validation is **one Zod schema per product type** under
[src/lib/products/schemas/](src/lib/products/schemas/), registered in
[`registry.ts`](src/lib/products/registry.ts) (`SCHEMA_BY_TYPE` mirrors
`CHILD_TABLE_BY_TYPE`; `validateProduct` is the single entry point). Each
schema also owns the flat-form → child-row mapper, and a drift assertion ties
its inferred shape to the generated child table type — add a column in the
migration, regenerate types, and the schema fails to compile until updated.

### Status (Order & Job)

Orders and jobs have **separate, independent lifecycles**; the only coupling
is that jobs cannot leave setup while the order is still a quote.

**Order lifecycle** (`order_status`): `QUOTE` → `IN_PROGRESS` → `FINISHED` →
`BILLED`. Every transition is **manual**, through the single lifecycle button
in the order header ([`OrderDetails`](src/components/OrderDetails.tsx)), with
one automatic step: an invoice order finishes on its own when its last job
is done.

- *Start processing* (`QUOTE` → `IN_PROGRESS`).
- **Automatic finish** (`IN_PROGRESS` → `FINISHED`) — the moment every
  non-cancelled job of an invoice order is `DONE` (a job marked done, or the
  last open job cancelled or deleted), the order moves to `FINISHED` by itself
  (`deriveAutomaticOrderStatus` in
  [src/lib/status/automaticStatus.ts](src/lib/status/automaticStatus.ts),
  applied by `useFinishOrderWhenAllJobsDone` from the job mutations; history
  `ORDER_FINISHED` with `meta.automatic`). It fires on those events only, so
  a reopened order stays open until something changes again.
- *Mark finished* (`IN_PROGRESS` → `FINISHED`) — the manual fallback, offered
  only once every non-cancelled job is `DONE` (e.g. after a reopen). **Cash
  orders skip `FINISHED`** and never auto-finish: their action is *Finish &
  close*, which goes straight to `BILLED` and archives — that step records the
  cash payment, which the last job being done says nothing about.
- *Mark as invoiced* (`FINISHED` → `BILLED`) — archives the order; it stays
  listed (and selected) as billed.
- Admins may *reopen* a finished order (`FINISHED` → `IN_PROGRESS`).
- Finished/billed orders are read-only: no new jobs, no product edits.
- Archive (hide) and cancel (cancel every job, then hide) are available in
  any non-billed state; a quote can be deleted outright from the sidebar.

**Job workflow** (`job_status`): `IN_SETUP` → `PREPRESS` → `IN_PRODUCTION` →
`DONE`. The rules live in one place each:

- **Completeness** — [src/lib/jobShared.ts](src/lib/jobShared.ts):
  `isJobComplete` (effective deadline present, at least one product; nothing
  is required while the order is a quote), `isDeadlineMissed` (derived
  warning, never a gate: an open job whose effective deadline lies strictly
  before today, local time), `isMissingInfo` (derived warning, never
  a gate: an open job with no effective deadline once the order is past
  quote — `isMissingDeadline`, which also rings the order's deadline field
  —, a job in pre-press or production with nobody assigned —
  `isMissingAssignee`, which also rings the job header's assignee picker —
  or a job in production that fails completeness, typically after a force
  release). The rules are the same for every department and product
  type — there is no free-form exception.
- **Automatic `IN_SETUP` ↔ `PREPRESS`** — `deriveAutomaticStatus` in
  [src/lib/status/automaticStatus.ts](src/lib/status/automaticStatus.ts), run
  by [`useStatusManager`](src/queries/useStatusManager.ts) for every
  non-committed job of the open order. A complete job whose customer has the
  required contact data is promoted to `PREPRESS` on its own
  (`PREPRESS_READY_AUTO`), whatever its department — so starting processing
  on an order promotes every complete job at once; it is retracted to
  `IN_SETUP` when it stops being complete or the order drops back to quote.
  A past deadline plays no part. It never touches `IN_PRODUCTION` / `DONE`.
- **Manual advance** — [`useJobRelease`](src/hooks/useJobRelease.ts), shared by
  the header's `JobReleaseButton` and the job list's context menu: *Release to
  Pre-Press* (a manual fallback; complete jobs normally get there on their
  own), *Release to Production*,
  *Mark job as done*. Each confirms first and writes its history event
  (`PREPRESS_READY_MANUAL`, `PRODUCTION_READY_SET`, `MARKED_DONE`).
- **Removal** — [`useJobRemoval`](src/hooks/useJobRemoval.ts): a job in setup
  is deleted; past setup it is cancelled (kept for history); once in
  production or done it can be neither.
- **Force release** — admins can push an incomplete or stock-blocked
  job straight into production from the release button's dropdown; a reason
  is required and recorded as `EMERGENCY_TRIGGERED`. Customer approval is the
  one gate the force release does not bypass.

## Workflow specifics

- **Release to production** (`PREPRESS` → `IN_PRODUCTION`) books
  **automatic stock deductions** (only here, not on "mark done") via the
  `book_production_deductions` RPC — one transaction, row-locked conditional
  decrements, `AUTO_DEDUCTION` movement rows with a note incl. the order number
  ([`productionReleaseService`](src/services/productionReleaseService.ts)):
  - **STAMP:** stamp-model products decrement their model (plus the matching
    replacement pad for a catalog ink colour); `TRODAT_PAD` products decrement
    their pad variant.
  - **TEXTILE:** every own-stock garment with a set `variant_id` decrements the
    variant by the product quantity.
  - Insufficient stock **blocks the release** (shortage rows highlighted in the
    product table, release button disabled while in pre-press, and the RPC
    rejects atomically if a concurrent release consumed the stock first). The
    admin **force release** bypasses the shortage: stock is floored at 0 and
    movements record what was actually deducted.
- **Release to pre-press** requires a complete job; a deadline that has
  passed does not block it (the row shows the deadline-missed flag instead).
  While a job is held in setup, `JobProductionBanner` names every unmet
  requirement (no deadline, no product), and the order's deadline field
  pulses until a deadline is set (`DeadlinePicker` `attention`). The admin
  force release bypasses both.
- **Job settings overrides** — a job inherits deadline, delivery and priority
  from the order unless its "separate …" switch is on; setting an override
  equal to the order's value collapses it back to inherit. Deadline and
  approval are locked once the job is in production; everything is read-only
  once done.
- **Customer approval** — toggled per job in its settings; when required, the
  release to production stays blocked until an approval is granted against
  one of the order's files (`CUSTOMER_APPROVAL_GRANTED`, file id in `meta`).
- **ERP export** — table `erp_exports` (`order_id`, `mode` (`SINGLE`|`BULK`),
  `export_data`) and [`erpService`](src/services/erpService.ts) exist; no UI
  currently triggers an export.
- **Duplicate order** — RPC `duplicate_order` deep-copies an order (jobs,
  products incl. the typed child by `type`, `product_files`, textile rows) in one
  transaction; called from [`DuplicateDialog`](src/components/DuplicateDialog.tsx).
- **PDF production sheet** — per job, from the job header
  ([`src/lib/pdf/orderPdf.ts`](src/lib/pdf/orderPdf.ts); German output is
  intentional).

## Key Files (selection)

| Path | Role |
|------|------|
| [`src/App.tsx`](src/App.tsx) / [`src/context/navigation.context.tsx`](src/context/navigation.context.tsx) | Providers, navbar, view switch, active order/job selection, deep-link pickup |
| [`src/pages/OrderWorkspace.tsx`](src/pages/OrderWorkspace.tsx) | Session gate + the two-column orders shell |
| [`src/pages/ProductionPage.tsx`](src/pages/ProductionPage.tsx) / [`src/components/production/`](src/components/production/) | The cross-order job feed (pre-press + production) with the assignee filter, and the selected job's detail beside it |
| [`src/pages/SettingsPage.tsx`](src/pages/SettingsPage.tsx) / [`src/components/settings/`](src/components/settings/) | Settings shell with section list; user management and department defaults |
| [`src/components/OrderDetails.tsx`](src/components/OrderDetails.tsx) | Order header, lifecycle actions, settings row, job list + detail host |
| [`src/hooks/useJobRelease.ts`](src/hooks/useJobRelease.ts) / [`useJobRemoval.ts`](src/hooks/useJobRemoval.ts) | Every job workflow rule, shared by button and context menu |
| [`src/lib/jobShared.ts`](src/lib/jobShared.ts) | Inheritance + completeness (`resolveEffectiveJob`, `isJobComplete`, `isDeadlineMissed`) |
| [`src/lib/status/automaticStatus.ts`](src/lib/status/automaticStatus.ts) / [`src/queries/useStatusManager.ts`](src/queries/useStatusManager.ts) | Automatic setup ↔ pre-press transition |
| [`src/const/orderStatus.ts`](src/const/orderStatus.ts) | Status labels/colours for orders and jobs |
| [`src/types/product.ts`](src/types/product.ts) | Typed product model: `LoadedProduct`, `ProductWriteInput`, `ChildTable`, `CHILD_TABLE_BY_TYPE` |
| [`src/lib/products/registry.ts`](src/lib/products/registry.ts) | Per-type Zod schema registry, `validateProduct` |
| [`src/types/database.ts`](src/types/database.ts) | App-facing row/enum aliases over the generated `supabase.ts` |
| [`src/types/supabase.ts`](src/types/supabase.ts) | Generated DB types (regenerate after migrations) |
| [`src/services/departmentProductService.ts`](src/services/departmentProductService.ts) | Product CRUD (parent + typed child), file links, motif links |
| [`src/services/orderService.ts`](src/services/orderService.ts) / [`jobService.ts`](src/services/jobService.ts) | Orders (list, filters, lifecycle, `duplicate_order`) and jobs |
| [`src/services/productionReleaseService.ts`](src/services/productionReleaseService.ts) | Stock requirements, shortage check, `book_production_deductions` |
| [`src/services/textileService.ts`](src/services/textileService.ts) / [`textileMasterDataService.ts`](src/services/textileMasterDataService.ts) | Textile per-order (motifs, variant lookups) + master data |
| [`src/services/historyService.ts`](src/services/historyService.ts) | History events |
| [`electron/`](electron/) | Main process: window, app protocol, deep links, IPC bridge, updater |
| [`.plans/DB_RENAME_MAP.md`](.plans/DB_RENAME_MAP.md) | German→English schema map (authoritative) |

## Notes for Developers

- The application architecture (navbar + view switch, sidebar + order
  details shell, per-department product modules, manual order lifecycle with
  automatic job pre-press, file linking instead of upload, products as parent
  + typed child tables) is fixed; no restructuring intended.
- The colour system is centralised in `src/index.css` as CSS variables — consume
  the tokens, don't hardcode colours.
- The database is live. A schema or master-data change is a new migration
  file, verified locally and by the e2e suite, followed by regenerated types
  — never a dashboard edit or a change to an applied migration.
- **Open refactor streams** (see `.plans/`): value-rename of stored enum strings
  to English; the i18next UI-string pass. Don't fold these into unrelated work.
- Dead code awaiting removal: [`src/components/JobTabs.tsx`](src/components/JobTabs.tsx)
  (replaced by `JobList`, no longer imported).
