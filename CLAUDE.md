# Auftragssystem — Order Intake & Production Control

Internal desktop tool for a print and advertising shop (product name in the
app: **Print And More**). Used by a small team to manage customer orders
across multiple production departments: order intake, status tracking
through the production workflow, inventory, customer approvals, time
logging, and history logging.

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
  orders, products, …) are the schema as it stands; a correction is a new
  migration on top, never an edit of the file that is already applied. The
  current baseline is the `20260930…` set the job elimination rewrote
  ([.plans/JOB_ELIMINATION.md](.plans/JOB_ELIMINATION.md)) — a one-off
  suspension of this rule, agreed with the client against a database reset;
  the rule holds again from that baseline.
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
- **Rename maps** (use these; don't invent parallel names):
  [.plans/DB_RENAME_MAP.md](.plans/DB_RENAME_MAP.md) (schema identifiers, enum
  types, enum/check values, functions) and [.plans/I18N_MAP.md](.plans/I18N_MAP.md)
  (UI display strings → i18next). Both are *finished plans*: they settle what
  a German name became, and are frozen at that point — where a later stream
  renamed something again, its own plan is the newer word (the job elimination
  is the one that has, see [.plans/JOB_ELIMINATION.md](.plans/JOB_ELIMINATION.md)).
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

**Project documentation lives in Obsidian.**

The documentation that describes the *business* — how the shop works, what a
feature is meant to do, what was agreed with the client — is written in the
**Obsidian vault, folder `Print And More`** (on this machine
`/mnt/c/Users/brian/Documents/Obsidian Vault/Print And More/`; index note
`Print And More.md`). It is deliberately **not** kept in this repository, and
it is **a source of truth to consult when assessing or planning work**,
alongside the code and Jira.

- **Written there:** process maps (`.bpmn` plus the note that embeds it — see
  the `process-map` skill), the written plan for a workflow or feature, the
  client-facing documents (what we sent the client, what came back), test
  plans and system documentation meant to be walked through with the shop,
  settings and catalog documentation, diagrams. The test: if the audience is
  the client or the business rather than someone editing this codebase, it is
  a vault note.
- **Stays in the repo:** documentation that only makes sense next to the code
  — [DOCS.md](DOCS.md) and [docs/](docs/) (coding standards, skill docs, tool
  reference), the e2e suite's own README and its test registry, the rename
  maps, and the stream records in [.plans/](.plans/).
- **Conventions:** one note per subject, named in sentence case with spaces
  (`Shipping plan.md`, `Shipping client review.md`); notes reference each
  other with `[[wikilinks]]`, not with repo paths, and are listed on the index
  note. A map note describes the **target state** and is kept current; a plan
  note carries the same `Created:` / `Finished:` header as a repo plan and is
  a record once finished.
- **Vault first, code second.** A feature is thought through, written up and
  agreed in Obsidian before it is built, so the vault is where expectations
  are settled and the place to read before proposing work. When the code and
  the vault note disagree, that is a discrepancy to raise — don't silently
  change the code to match the note, or the note to match the code.

**Where things go**
- **CLAUDE.md** (this file) — stable architecture, domain model, workflows. No
  version pins, no pixel widths, no status or to-do lists (those live in Jira).
- **[DOCS.md](DOCS.md)** — documentation index; entry point to
  [docs/](docs/) (coding standards, skill docs, reference). Consult it for the
  architectural patterns to follow.
- **Obsidian vault `Print And More/`** — the business and client-facing
  documentation: process maps, workflow plans, client reviews, system and
  settings documentation. Outside the repo; see "Project documentation lives
  in Obsidian" above. New documents of that kind are created there, not under
  `.plans/`.
- **[.plans/](.plans/)** — one file per work stream: the decisions it locked,
  the packages it shipped, and what each one found. It is the project's
  **history**, not a reference that tracks the current code — see "Plans are
  a record" below before touching anything in it. Examples:
  [electron_porting.md](.plans/electron_porting.md) /
  [electron_workplan.md](.plans/electron_workplan.md) (the Electron port),
  [JOB_ELIMINATION.md](.plans/JOB_ELIMINATION.md) (the product replacing the
  job as the unit of work), [DB_RENAME_MAP.md](.plans/DB_RENAME_MAP.md) (the
  German→English schema rename). It keeps the engineering record of the
  streams already in it; a new workflow plan or client document belongs in the
  vault instead.
- **`package.json`** = library versions; CSS files = UI dimensions. Don't
  duplicate those into prose.

**Plans are a record, not a living document.**

Every file in `.plans/` carries, directly under its title, the date it was
started and the date it was finished:

```
Created: 2026-09-29
Finished: 2026-10-01
```

`Finished: —` while the stream is still running; fill the date in with the
last package. A plan that is still open is written in as it goes — that is
what the per-package "done" entries are for.

**Once a plan is finished it is never edited again.** Not to correct it, not
to fold in a later rename, not to note that something it describes has since
changed. The point of keeping these files is to be able to read back what was
decided and done *at that time*; editing one erases the trace. A later change
writes its own plan, and may link to the older one — a finished plan being
out of date relative to today's code is expected, not a defect to repair.
This is why `DB_RENAME_MAP.md` still describes the schema as it stood after
the German→English rename and says nothing about the job elimination that
came later.

The same holds for a **plan note in the Obsidian vault**: it carries the same
header and is equally a record once finished. The **process maps and their
notes are the exception** — they describe the target state of the business
process, so they are edited as that process changes.

## Tech Stack

- **Frontend:** React + TypeScript + Vite; TanStack Query for server state
  (`src/queries/*`), TanStack Form + Zod for product forms.
- **Styling:** Tailwind CSS + CSS variables (colour system in `index.css`);
  shadcn-style primitives vendored under `src/components/ui/*`.
- **Backend:** Supabase — PostgreSQL with Auth and Row-Level Security; RLS
  policies and triggers live in the migrations. The base schema is split into
  domain migration files under `supabase/migrations/` (types, core, orders,
  products, catalog, one file per department's product tables, blueprint,
  audit, duplicate_order); everything after that baseline is a dated
  migration on top of it, and that is the only way the schema changes (see
  "The app is in production" above). `supabase/seed.sql` holds catalog
  master data; `seed.dev.sql` (git-ignored) holds local demo data. One edge
  function, `manage-users`, exists for what the browser cannot do
  (create/delete auth accounts).
- **Client:** [src/supabase.ts](src/supabase.ts) (`createClient`); generated
  types in [src/types/supabase.ts](src/types/supabase.ts), app-facing aliases
  in [src/types/database.ts](src/types/database.ts).
- **Service layer:** DB access goes through `src/services/*`; components read
  and mutate through the hooks in `src/queries/*`, never `supabase` directly.
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
view. There is **no router**: the view and the active order/product selection
live in [`navigation.context.tsx`](src/context/navigation.context.tsx)
(`AppView`: `orders`, `production`, `stampStock`, `textileStock`, `settings`,
`profile`, `releaseNotes`). Orders and production are for everyone; the stock
views and settings are admin-only, and the user-management section inside
settings is super-admin only.

### The orders view

[`OrderWorkspace`](src/pages/OrderWorkspace.tsx) renders the login layout
without a session, otherwise a two-column shell:

| Column | Component | Role |
|--------|-----------|------|
| Left   | [`OrderSidebar`](src/components/OrderSidebar.tsx) | Search + filters (status, department, deadline/intake ranges), order list with selection, per-order menu (duplicate / delete quote), "+ New Order" ([`NewOrderDialog`](src/components/NewOrderDialog.tsx)). Archived orders are listed only while the header's *Show archived* toggle is on, except billed ones, which appear whenever Billed is ticked; the default status filter ticks every status, so completed orders stay in the feed. There is no assignee filter here — finding one's own work is what the production view is for. |
| Centre | [`OrderDetails`](src/components/OrderDetails.tsx) | Order header (number, customer, lifecycle button, archive/cancel actions), order settings row (deadline, delivery, priority, payment), then the order tabs: *Products* — [`ProductList`](src/components/ProductList.tsx) (one add-product button per department, one row per product with status track and right-click menu, plus the row of a product being added) next to the active product's [`ProductDetail`](src/components/ProductDetail.tsx) or the [`ProductDraftPanel`](src/components/products/ProductDraftPanel.tsx) of a product being added — and *History* ([`OrderHistory`](src/components/OrderHistory.tsx)). |

`ProductDetail` shows the product header (assignee, status badge, PDF /
delete-or-cancel actions, the
[`ProductReleaseButton`](src/components/ProductReleaseButton.tsx)), the
[`ProductProductionBanner`](src/components/ProductProductionBanner.tsx) naming
the unmet release requirement, and the product tabs: *Basic info* (the type's
own form, inline — read-only until *Edit*, with `QuickTimeLog` at its bottom;
[`ProductBasicInfo`](src/components/products/ProductBasicInfo.tsx)), *Time
logs*, *Settings* (separate deadline/delivery/priority overrides, customer
approval; [`src/components/productDetail/`](src/components/productDetail/))
and *Files* ([`OrderFiles`](src/components/OrderFiles.tsx)). The files belong
to the order; the tab sits on the product so the production view, which shows
only a product, has them too. Every workflow action lives in the header of the
order or the product (or the product list's context menu).
[`useStatusManager`](src/queries/useStatusManager.ts), called by
`OrderDetails`, runs the automatic status logic (see "Status") — one effect
per order, over all of its products.

### Row flags and due dates

The order sidebar, the product list and the production feed share their row
markers. [`Flags.tsx`](src/components/Flags.tsx) holds the red icon flags,
all the same colour and told apart by shape: *missing information*
(`isMissingInfo`), *deadline missed* (`isDeadlineMissed`) and *high
priority* (effective priority for a product). An order row carries a
product's flag when any of its products does. [`DueDate`](src/components/DueDate.tsx) renders a
row's deadline as "Due today" (red), "Due tomorrow" (orange) or "Due Sep
28th" (`formatDateHuman` in [src/lib/formatDate.ts](src/lib/formatDate.ts)),
with the exact date in the tooltip.

### The production view

[`ProductionPage`](src/pages/ProductionPage.tsx) is the back office's view
of the work: the same two-column shell as the orders view, with
[`ProductionSidebar`](src/components/production/ProductionSidebar.tsx)
listing **products across all orders** — every non-cancelled product in
`PREPRESS` or `IN_PRODUCTION` on a non-archived order
(`productService.listProductionProducts`, `useProductionProducts`), `HIGH`
priority first regardless of date, then soonest effective deadline first. A
row shows department, customer, product number, effective deadline (as a
relative due date, see "Row flags and due dates"), status and assignee. The
header's assignee filter is the product header's `EmployeeCombobox` (one user
or *Everyone*) with a caption stating what the feed shows; every user, admins
included, starts on their own products. Selecting a row (`selectProduct` in
the navigation context) shows the product in
[`ProductionProductPanel`](src/components/production/ProductionProductPanel.tsx):
a read-only strip naming the order (customer, number, deadline, status, an
*Open in orders* button) above the same `ProductDetail` the orders view uses,
edited in place, with the order's `useStatusManager` running alongside. The
selection is the app-wide one, so the order stays selected when switching
to the orders view. Order-level actions (lifecycle, settings, history)
remain on the orders view; the product's tabs, *Files* included, work here as
there.

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
sidebar and the product list are fixed-width columns that are simply narrower in
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
[`DuplicateDialog`](src/components/DuplicateDialog.tsx).
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
Admin-only actions in the orders view: force-release a product, reopen a
finished order, log time on someone else's behalf or delete a time log.
Anyone may assign or reassign a product. Account creation/deletion goes through
the `manage-users` edge function; role changes are plain updates on `users`,
guarded by RLS and a trigger. DB triggers backstop every role rule — the UI
only hides what the DB would reject anyway.

**Developer accounts.** A super admin who signs in to the shop's database to
debug should never be handed work. The user-management section has a
*Developer* switch per account (`users.is_developer`, changeable by super
admins only, a super admin row only by the account itself); the
`EmployeeCombobox` leaves flagged accounts out of every picker (product
assignee, production filter, time logs, department defaults) unless one
already holds the value shown. The flag is per database, so a local
database simply leaves it off.

**Product assignment.** A product starts unassigned; whoever intakes the order
usually does not work on it. Each department can name a default assignee
per stage (`department_default_assignees`, one user for `PREPRESS` and one
for `IN_PRODUCTION`, set on the settings page). The moment a product enters one
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
— textile master data (brand → model → variant) and variant stock;
`SettingsPage` ([src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx)) —
a fixed, always-visible section list on the left and the active section on
the right: *User management* (super admins;
[`UserManagementSettings`](src/components/settings/UserManagementSettings.tsx))
and *Departments* (admins; [`DepartmentSettings`](src/components/settings/DepartmentSettings.tsx),
the default assignee per department); `ProfilePage`. Shared stock UI
(booking fields, movement views, reorder list) lives in
[`src/components/stock/`](src/components/stock/).

## Production Departments (`department` enum)

Every order has 0…n products, each belonging to one production department.
Enum `department`: `LFP`, `COPYSHOP`, `TEXTILE`, `STAMP`, `LASER_ENGRAVING`,
`OTHER` (display labels and product-number abbreviations in
[`src/lib/departmentLabels.ts`](src/lib/departmentLabels.ts)).
Each department contributes a set of per-type forms and per-type Zod schemas:

| Department | Forms | Schemas |
|---------|-------|---------|
| LFP (large format) | [`forms/lfp.tsx`](src/components/products/forms/lfp.tsx) | [`schemas/lfp.ts`](src/lib/products/schemas/lfp.ts) |
| CopyShop | [`forms/copyshop.tsx`](src/components/products/forms/copyshop.tsx) | [`schemas/copyshop.ts`](src/lib/products/schemas/copyshop.ts) |
| Textile | [`forms/textile.tsx`](src/components/products/forms/textile.tsx) | [`schemas/textile.ts`](src/lib/products/schemas/textile.ts) |
| Stamp | [`forms/stamp.tsx`](src/components/products/forms/stamp.tsx) | [`schemas/stamp.ts`](src/lib/products/schemas/stamp.ts) |
| Laser | [`forms/laser.tsx`](src/components/products/forms/laser.tsx) | [`schemas/laser.ts`](src/lib/products/schemas/laser.ts) |
| Other | [`forms/other.tsx`](src/components/products/forms/other.tsx) | [`schemas/other.ts`](src/lib/products/schemas/other.ts) |

There is **no per-department section component**: a detail view shows one
product, so there is nothing to list. What those sections owned is now two
lookups that both hosts read —
[`productTypes.tsx`](src/components/products/productTypes.tsx) maps a type to
its form (`FORM_BY_TYPE`), and
[`productTypeLabels.ts`](src/lib/productTypeLabels.ts) holds the types each
department offers and their labels (`PRODUCT_TYPES_BY_DEPARTMENT`,
`PRODUCT_TYPE_LABELS`, shared with the PDF sheet). The two hosts are
[`ProductDraftPanel`](src/components/products/ProductDraftPanel.tsx) (the form
of the type being added, on create) and
[`ProductBasicInfo`](src/components/products/ProductBasicInfo.tsx) (the same
form, on the detail view's first tab). Creating through the type's own
validated form is deliberate: it keeps the invariant that a stored product has
a valid spec.

**Adding a product starts a draft.** An add button names a department and
offers its product types in a menu (a single-type department skips it);
picking one starts a **draft product** — `productDraft` (department + type) in
[`navigation.context.tsx`](src/context/navigation.context.tsx), mutually
exclusive with `activeProductId`. The draft shows as a dashed row in
`ProductList` and as its type's form where `ProductDetail` would be. It has no
workflow header and no tabs, since assignee, status, release, PDF, time logs,
settings and files all act on a persisted row. Save validates the type's Zod
schema, writes parent + child, and selects the new product; Cancel drops the
draft and the previous product is reselected. **The draft is derived for the
list and nothing else** — it never enters `useProductsByOrderId`, whose data
also drives `useStatusManager` and `areAllProductsDone`, so an unsaved product
cannot hold an order open.

## Domain Model

- **Customer** — table `customers` (`name`, `email`, `phone`, `note`, address
  fields, `is_archived`). Created/edited via `CustomerDialog`; searched by
  `ilike` on `name` (only `is_archived = false`). A customer needs a name plus
  email or phone before a product may auto-advance to pre-press
  (`customerMeetsPrepressContact` in [src/lib/customer.ts](src/lib/customer.ts)).
- **Order** — table `orders` (`order_number` from a DB counter, `customer_id`,
  `status`, `deadline`, `delivery` (`PICKUP`|`SHIPPING`), `priority`
  (`NORMAL`|`HIGH`), `payment_method` (`INVOICE`|`CASH`), `billing_note`,
  `is_archived`, `created_by`, `created_at`). A new order is created as a
  quote with its deadline pre-filled to one week from today (a local date,
  set by `NewOrderDialog`, not a DB default). The header fields save on
  change, one field per save, each logged as a `SETTINGS_CHANGED` history
  entry.
- **Product** — table `products`, the unit of work: one object carrying both
  the production workflow and the specification (the typed child tables
  below). Workflow half: `product_number` (`<order_number>-<DEPT>-<NN>`,
  assigned by a DB trigger from `product_number_counter`, never by the
  client), `order_id`, `department`, `status`, `deadline` / `delivery` /
  `priority` (**nullable = inherit from the order**; `resolveEffectiveProduct`
  in [src/lib/productShared.ts](src/lib/productShared.ts) resolves the
  effective values), `assignee_id`, `is_cancelled`, and the customer-approval
  fields (`customer_approval_required` / `_granted` / `_file_id`). Spec half:
  `type` (the child-table discriminator), `quantity`, `notes`, `sort_order`
  (ordering the products within their order).
- **Time logs** — table `product_time_logs`: worked-time entries per product
  (`minutes` > 0, `created_at`). `user_id` = the employee the time is
  attributed to; `created_by` = who wrote the row. Employees log as
  themselves; only admins may log on someone else's behalf or delete a log
  (RLS-enforced). The product's total time is `SUM(minutes)` over its logs —
  there is no aggregate column. Every create/delete writes a history event
  (`TIME_LOGGED` / `TIME_LOG_DELETED`). UI:
  [`ProductTimeLogs`](src/components/ProductTimeLogs.tsx) on the product's
  *Time logs* tab, plus `QuickTimeLog` from the same file at the bottom of the
  *Basic info* tab — the same entry form without the list, so time is logged
  where the work is looked at; service
  [`timeLogService`](src/services/timeLogService.ts).
- **Files** — table `files` (`order_id`, `display_name`, `path`, `role`
  (`PRODUCTION_FILE` | `PREVIEW` | `CUSTOMER_APPROVAL` | `REFERENCE`)).
  Attached at the **order** level via `OrderFiles` on each product's *Files* tab (drop or pick files;
  the desktop bridge resolves the real path), and from the shared
  [`FilePicker`](src/components/FilePicker.tsx) inside any product form, which
  links a dropped file to the order and hands it to the product in one go — as
  an attachment on the other types, as a design on a textile batch; products
  link to them through `product_files`; a customer approval is granted against
  one of them.
  UNC-path **linking**, not upload — the files stay on the network share, and
  "open" reveals them through `window.pam.revealPath`.
- **History** — table `history` (`order_id`, `product_id`, `event_type`
  (`history_event` enum), `user_id`, `meta`). Written alongside every
  workflow action by [`historyService`](src/services/historyService.ts);
  shown on the order's *History* tab (`OrderHistory`).
- **Products** — see below (the typed per-type model).
- **Textile master data** — `textile_brands` → `textile_models` →
  `textile_variants` (`color`, `color_hex`, `size`, `stock`, `min_stock`),
  `textile_stock_movements`. A *model* is the garment ("T-Shirt #E190"), a
  *variant* one colour and size of it. Per-order textile data hangs off the
  product: a `TEXTILE_GARMENT` product is a **batch**, with one
  `textile_garments` line per model × colour × size (`origin` `SHOP_SUPPLIED`
  with a catalog `variant_id` or free-text brand/model/colour/size, or
  `CUSTOMER_SUPPLIED`) and one `textile_designs` row per design and placement.
- **Stamp master data** — `stamp_models`, `stamp_ink_colors`,
  `stamp_stock_movements`.
- **Users** — table `users` (`name`, `email`, `role`, `avatar_url`,
  `is_developer`), mirrored from Supabase Auth. `is_developer` marks a
  developer account (someone debugging against the shop's database): it is
  left out of every assignee picker and grants nothing.
- **Department defaults** — table `department_default_assignees`
  (PK `(department, status)` with `status` limited to `PREPRESS` /
  `IN_PRODUCTION`, `user_id` → `users`, cascade on delete): the user a product
  of that department is handed to when it enters that stage. Readable by
  all, admin-writable; service
  [`departmentSettingsService`](src/services/departmentSettingsService.ts).
- **Blueprint** — `blueprint_*` tables exist in the schema (a separate
  blueprint-copying feature) but nothing in the client uses them yet.
- **Retired ERP export** — the `erp_exports` table, `orders.is_erp_exported`
  and the `ERP_EXPORTED` history event are left over from an export feature
  the shop retired. Nothing in the client reads, writes or renders them;
  dropping them is a migration of its own. Don't build on them.

### Products — typed per-type tables

The specification half of a product is modelled supertype/subtype
(class-table inheritance):

- **Parent `products`** — the workflow columns above plus `department`,
  `type` (discriminator), `quantity`, `notes`, `sort_order`, `created_at`.
- **One typed child table per product type** (30 of the 31 types: 7 CopyShop,
  9 Stamp, 8 LFP, 5 Laser, 1 Other), PK = FK to `products` (`product_id`),
  holding that type's English spec columns. The `type` value selects the child
  (e.g. `POSTER` → `poster_products`, `TRODAT_PRINTY` →
  `trodat_printy_products`).
- **TEXTILE is the deliberate exception**: its single type `TEXTILE_GARMENT`
  is a *batch*, so instead of one child row it owns many `textile_garments`
  lines (one per model × colour × size, each with its own quantity — the
  parent `quantity` stays NULL, the batch total is their sum) and its
  `textile_designs` (one per design and placement; a design is declared once
  and holds for every line). This is the only 1:n child.
- **`product_files`** — M:N file links on the parent (`product_id` →
  `products`, `file_id` → `files`).

**Code contract:** [src/types/product.ts](src/types/product.ts) defines
`LoadedProduct` — a union of the 30 single-child arms (parent + typed `child`)
and the textile arm (parent + `garments[]` + `designs[]`) — plus
`ProductWriteInput`, the `ChildTable` union, `CHILD_TABLE_BY_TYPE` /
`childTableForType()` (which throws for textile, as it has no single child)
and the `isSingleChildProductType` guard for callers that can see either
shape. [`productService`](src/services/productService.ts) is the only product
service and owns both halves: the workflow (`setStatus`, `cancel`,
`setCustomerApproval`, `listProductionProducts`) and the spec
(`getLoadedByOrderId` / `getLoadedById`, `createProduct` / `updateProduct` —
a TS two-step, insert/update parent then children, no RPC —, `deleteProduct`
(cascade) and the `product_files` helpers). Validation is **one Zod schema per
product type** under [src/lib/products/schemas/](src/lib/products/schemas/),
registered in [`registry.ts`](src/lib/products/registry.ts) (`SCHEMA_BY_TYPE`
covers all 31 types; `validateProduct` is the single entry point). Each
schema also owns the flat-form → child-row mapper, and a drift assertion ties
its inferred shape to the generated child table type — add a column in the
migration, regenerate types, and the schema fails to compile until updated.

### Status (Order & Product)

Orders and products have **separate, independent lifecycles**; the only
coupling is that products cannot leave setup while the order is still a
quote.

**Order lifecycle** (`order_status`): `QUOTE` → `IN_PROGRESS` → `FINISHED` →
`BILLED`. Every transition is **manual**, through the single lifecycle button
in the order header ([`OrderDetails`](src/components/OrderDetails.tsx)), with
one automatic step: an invoice order finishes on its own when its last
product is done.

- *Start processing* (`QUOTE` → `IN_PROGRESS`).
- **Automatic finish** (`IN_PROGRESS` → `FINISHED`) — the moment every
  non-cancelled product of an invoice order is `DONE` (a product marked done,
  or the last open one cancelled or deleted), the order moves to `FINISHED` by
  itself (`deriveAutomaticOrderStatus` in
  [src/lib/status/automaticStatus.ts](src/lib/status/automaticStatus.ts),
  applied by `useFinishOrderWhenAllProductsDone` from the product mutations;
  history `ORDER_FINISHED` with `meta.automatic`). It fires on those events
  only, so a reopened order stays open until something changes again.
- *Mark finished* (`IN_PROGRESS` → `FINISHED`) — the manual fallback, offered
  only once every non-cancelled product is `DONE` (e.g. after a reopen).
  **Cash orders skip `FINISHED`** and never auto-finish: their action is
  *Finish & close*, which goes straight to `BILLED` and archives — that step
  records the cash payment, which the last product being done says nothing
  about.
- *Mark as invoiced* (`FINISHED` → `BILLED`) — archives the order; it stays
  listed (and selected) as billed.
- Admins may *reopen* a finished order (`FINISHED` → `IN_PROGRESS`).
- Finished/billed orders are read-only: no new products, no spec edits.
- Archive (hide) and cancel (cancel every product, then hide) are available in
  any non-billed state; a quote can be deleted outright from the sidebar.

**Product workflow** (`product_status`): `IN_SETUP` → `PREPRESS` →
`IN_PRODUCTION` → `DONE`. The rules live in one place each:

- **Completeness** — [src/lib/productShared.ts](src/lib/productShared.ts):
  `isProductComplete` (the effective settings valid, which in practice means
  the effective deadline is set — delivery and priority always resolve from
  the order; nothing is required while the order is a quote),
  `isDeadlineMissed` (derived warning, never a gate: an open product whose
  effective deadline lies strictly before today, local time), `isMissingInfo`
  (derived warning, never a gate: an open product with no effective deadline
  once the order is past quote — `isMissingDeadline`, which also rings the
  order's deadline field —, a product in pre-press or production with nobody
  assigned — `isMissingAssignee`, which also rings the product header's
  assignee picker — or a product in production that fails completeness,
  typically after a force release). The rules are the same for every
  department and product type — there is no free-form exception. The
  product's *specification* is not part of completeness: the per-type Zod
  schema runs in the form, not in the gate.
- **Automatic `IN_SETUP` ↔ `PREPRESS`** — `deriveAutomaticStatus` in
  [src/lib/status/automaticStatus.ts](src/lib/status/automaticStatus.ts), run
  by [`useStatusManager`](src/queries/useStatusManager.ts) — one effect per
  open order, over every non-committed product it holds. A complete product
  whose customer has the required contact data is promoted to `PREPRESS` on
  its own (`PREPRESS_READY_AUTO`), whatever its department — so starting
  processing on an order promotes every complete product at once; it is
  retracted to `IN_SETUP` when it stops being complete or the order drops back
  to quote. A past deadline plays no part. It never touches `IN_PRODUCTION` /
  `DONE`.
- **Manual advance** — [`useProductRelease`](src/hooks/useProductRelease.ts),
  shared by the header's `ProductReleaseButton` and the product list's context
  menu: *Release to Pre-Press* (a manual fallback; complete products normally
  get there on their own), *Release to Production*, *Mark product as done*.
  Each confirms first and writes its history event (`PREPRESS_READY_MANUAL`,
  `PRODUCTION_READY_SET`, `MARKED_DONE`).
- **Removal** — [`useProductRemoval`](src/hooks/useProductRemoval.ts): a
  product in setup is deleted; past setup it is cancelled (kept for history);
  once in production or done it can be neither.
- **Force release** — admins can push an incomplete or stock-blocked
  product straight into production from the release button's dropdown; a
  reason is required and recorded as `EMERGENCY_TRIGGERED`. Customer approval
  is the one gate the force release does not bypass.

## Workflow specifics

- **Release to production** (`PREPRESS` → `IN_PRODUCTION`) books
  **automatic stock deductions** (only here, not on "mark done") via the
  `book_production_deductions` RPC — one transaction, row-locked conditional
  decrements, `AUTO_DEDUCTION` movement rows with a note incl. the order number
  ([`productionReleaseService`](src/services/productionReleaseService.ts)):
  - **STAMP:** stamp-model products decrement their model (plus the matching
    replacement pad for a catalog ink colour); `TRODAT_PAD` products decrement
    their pad variant.
  - **TEXTILE:** every shop-supplied garment line with a catalog `variant_id`
    decrements that variant by the line's own quantity.
  - Insufficient stock **blocks the release**: `ProductProductionBanner` names
    the short targets, the release button is disabled while in pre-press, and
    the RPC rejects atomically if a concurrent release consumed the stock
    first. A textile shortage carries its garment line id, so the batch's size
    grid highlights the short size rather than the whole batch. The admin
    **force release** bypasses the shortage: stock is floored at 0 and
    movements record what was actually deducted.
- **Release to pre-press** requires a complete product; a deadline that has
  passed does not block it (the row shows the deadline-missed flag instead).
  While a product is held in setup, `ProductProductionBanner` names the unmet
  requirement — the missing deadline, the only one left — and the order's
  deadline field pulses until a deadline is set (`DeadlinePicker`
  `attention`). The admin force release bypasses it.
- **Product settings overrides** — a product inherits deadline, delivery and
  priority from the order unless its "separate …" switch is on; setting an
  override equal to the order's value collapses it back to inherit. Deadline
  and approval are locked once the product is in production; everything is
  read-only once done.
- **Customer approval** — toggled per product in its settings; when required,
  the release to production stays blocked until an approval is granted against
  one of the order's files (`CUSTOMER_APPROVAL_GRANTED`, file id in `meta`).
- **Duplicate order** — RPC `duplicate_order` deep-copies an order (the
  selected products incl. their typed child by `type`, their `product_files`,
  and a textile batch's garment lines and designs) in one transaction; called
  from [`DuplicateDialog`](src/components/DuplicateDialog.tsx). Workflow state
  is not carried over — the copies start in setup.
- **PDF production sheet** — one sheet per product, from the product header
  ([`src/lib/pdf/productionSheet.ts`](src/lib/pdf/productionSheet.ts)): a
  label/value list of the product's set spec fields, with a textile batch's
  garment lines and designs as two tables, headed by the product's
  **effective** deadline, delivery and priority. Fetching is split from
  layout — `renderProductionSheet(data)` is pure and takes every lookup
  pre-resolved. The labels are English; only the dates are German
  (`formatDateDe`).

## Key Files (selection)

| Path | Role |
|------|------|
| [`src/App.tsx`](src/App.tsx) / [`src/context/navigation.context.tsx`](src/context/navigation.context.tsx) | Providers, navbar, view switch, active order/product selection, deep-link pickup |
| [`src/pages/OrderWorkspace.tsx`](src/pages/OrderWorkspace.tsx) | Session gate + the two-column orders shell |
| [`src/pages/ProductionPage.tsx`](src/pages/ProductionPage.tsx) / [`src/components/production/`](src/components/production/) | The cross-order product feed (pre-press + production) with the assignee filter, and the selected product's detail beside it |
| [`src/pages/SettingsPage.tsx`](src/pages/SettingsPage.tsx) / [`src/components/settings/`](src/components/settings/) | Settings shell with section list; user management and department defaults |
| [`src/components/OrderDetails.tsx`](src/components/OrderDetails.tsx) | Order header, lifecycle actions, settings row, product list + detail host |
| [`src/components/ProductDetail.tsx`](src/components/ProductDetail.tsx) / [`src/components/products/`](src/components/products/) | The product's header and tabs; the per-type forms, the draft panel of a product being added and the Basic info tab |
| [`src/hooks/useProductRelease.ts`](src/hooks/useProductRelease.ts) / [`useProductRemoval.ts`](src/hooks/useProductRemoval.ts) | Every product workflow rule, shared by button and context menu |
| [`src/lib/productShared.ts`](src/lib/productShared.ts) | Inheritance + completeness (`resolveEffectiveProduct`, `isProductComplete`, `isDeadlineMissed`, `areAllProductsDone`) |
| [`src/lib/status/automaticStatus.ts`](src/lib/status/automaticStatus.ts) / [`src/queries/useStatusManager.ts`](src/queries/useStatusManager.ts) | Automatic setup ↔ pre-press transition |
| [`src/lib/statusLabels.ts`](src/lib/statusLabels.ts) / [`departmentLabels.ts`](src/lib/departmentLabels.ts) / [`productTypeLabels.ts`](src/lib/productTypeLabels.ts) | Display maps: status labels/colours, department labels + abbreviations, product-type labels |
| [`src/types/product.ts`](src/types/product.ts) | Typed product model: `LoadedProduct`, `ProductWriteInput`, `ChildTable`, `CHILD_TABLE_BY_TYPE` |
| [`src/lib/products/registry.ts`](src/lib/products/registry.ts) | Per-type Zod schema registry, `validateProduct` |
| [`src/lib/pdf/productionSheet.ts`](src/lib/pdf/productionSheet.ts) | The per-product production sheet (fetch + pure `renderProductionSheet`) |
| [`src/types/database.ts`](src/types/database.ts) | App-facing row/enum aliases over the generated `supabase.ts` |
| [`src/types/supabase.ts`](src/types/supabase.ts) | Generated DB types (regenerate after migrations) |
| [`src/services/productService.ts`](src/services/productService.ts) | The product, both halves: workflow (status, assignee, approval, the production feed) and spec (parent + typed child, file links, textile lines and designs) |
| [`src/services/orderService.ts`](src/services/orderService.ts) | Orders: list, filters, lifecycle, `duplicate_order` |
| [`src/services/productionReleaseService.ts`](src/services/productionReleaseService.ts) | Stock requirements, shortage check, `book_production_deductions` |
| [`src/services/textileService.ts`](src/services/textileService.ts) / [`textileMasterDataService.ts`](src/services/textileMasterDataService.ts) | Textile catalog lookups for the batch editor + master data |
| [`src/services/historyService.ts`](src/services/historyService.ts) | History events |
| [`electron/`](electron/) | Main process: window, app protocol, deep links, IPC bridge, updater |
| [`.plans/DB_RENAME_MAP.md`](.plans/DB_RENAME_MAP.md) | German→English schema map (authoritative) |

## Notes for Developers

- The application architecture (navbar + view switch, sidebar + order
  details shell, the product as the unit of work, manual order lifecycle with
  automatic product pre-press, file linking instead of upload, products as
  parent + typed child tables) is fixed; no restructuring intended.
- The colour system is centralised in `src/index.css` as CSS variables — consume
  the tokens, don't hardcode colours.
- The database is live. A schema or master-data change is a new migration
  file, verified locally and by the e2e suite, followed by regenerated types
  — never a dashboard edit or a change to an applied migration.
- **Open refactor streams** (see `.plans/`): value-rename of stored enum strings
  to English; the i18next UI-string pass. Don't fold these into unrelated work.
- Business-process and client-facing documentation is in the Obsidian vault
  `Print And More/`, not in this repo. Read the relevant note before planning
  a feature or judging whether current behaviour is correct — it is what the
  client agreed to.
