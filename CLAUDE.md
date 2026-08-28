# Auftragssystem — Order Intake & Production Control

Internal web tool for a print and advertising shop. Used by a small team to
manage customer orders across multiple production departments: order intake,
status tracking through the production workflow, inventory, customer approvals,
history logging, and ERP export.

This file describes **architecture, domain model, and workflows** — the stable
properties of the application. For the **current implementation status** (what
is finished, what is open, known gaps) see [current_state.md](current_state.md).
The authoritative source for library versions is `package.json`; the
authoritative source for UI dimensions is the relevant CSS file.

**[DOCS.md](DOCS.md) is the entry point into the [docs/](docs/) folder.** It is
the main file to consult whenever you need to know the architectural patterns
we follow or should follow — coding standards, per-role skill docs, and
reference material. Read it (and the docs it links) before making changes.

> This file is also the project's `CLAUDE.md` (symlinked) — the conventions
> below apply to AI assistants working in this repo as well as to human
> contributors.

## Working with this project

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
  1. **Stored enum VALUE strings** (e.g. stamp `color='SCHWARZ'`, fold
     `'MITTELFALZ'`, installation `'MIT'`). Columns are plain `text`; UI labels
     already show English. Deferred to a shop-confirmed value-rename pass.
  2. **UI display strings** still hardcoded in components — the i18next pass
     ([I18N_MAP.md](.plans/I18N_MAP.md)) is not yet done.
- The product name **"Auftragssystem"** is a proper noun (repo/product name) and
  is left as-is.

**Issue tracking** — work is tracked in **Jira**, project/space **Markus**. When
asked about tasks/tickets, look there first.

**Where things go**
- **README.md** (this file) — stable architecture, domain model, workflows. No
  version pins, no pixel widths, no current-state info.
- **[current_state.md](current_state.md)** — what's done/pending, known debt.
- **[DOCS.md](DOCS.md)** — documentation index; entry point to
  [docs/](docs/) (coding standards, skill docs, reference). Consult it for the
  architectural patterns to follow.
- **`package.json`** = library versions; CSS files = UI dimensions. Don't
  duplicate those into prose.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + CSS variables (colour system in `index.css`)
- **Backend:** Supabase — PostgreSQL with Auth and Row-Level Security; RLS
  policies live in Supabase. The base schema is split into domain migration
  files under `supabase/migrations/` (types, core, orders, jobs,
  catalog, products_core, the per-department product tables, textile, audit,
  duplicate_order).
- **Client:** [src/supabase.ts](src/supabase.ts) (`createClient`); generated
  types in [src/types/supabase.ts](src/types/supabase.ts).
- **Service layer:** DB access goes through `src/services/*`; components avoid
  calling `supabase` directly (textile / PDF are the few exceptions).
- **Target platform:** desktop only — currently a desktop browser, eventually
  packaged as an **Electron** app. No mobile/touch support, but **small
  laptops (~1075px wide) must be usable**; see "Responsive layout" below.

## UI Layout

Three-column layout, full height:

| Column | Component | Role |
|--------|-----------|------|
| Left   | [`OrderSidebar`](src/components/OrderSidebar.tsx) | "+ New order" ([`NewOrderDialog`](src/components/NewOrderDialog.tsx)); order list with selection; archived orders excluded |
| Centre | [`WorkArea`](src/components/WorkArea.tsx) | Order header, files, job tabs ([`JobTabs`](src/components/JobTabs.tsx)), active job detail mask ([`JobDetail`](src/components/JobDetail.tsx)) |
| Right  | [`ContextPanel`](src/components/ContextPanel.tsx) | Status, workflow actions, hints (order + job workflow) |

### Responsive layout — one breakpoint, two strategies

The app has exactly **one breakpoint** and two layouts: *compact* (small
laptops) and *desktop*. It is defined once as `--breakpoint-desktop` (80rem /
1280px) in the `@theme` block of `src/index.css` and consumed two ways:

- **CSS / Tailwind:** base styles are the compact variant; apply the
  `desktop:` variant for the roomier layout (mobile-first). Don't introduce
  other breakpoints — `sm:`/`md:`/`lg:` should only appear inside vendored
  `src/components/ui/*` code.
- **TypeScript:** `useIsMobile()` (`src/hooks/use-mobile.ts`) returns `true`
  below the same width — it reads `--breakpoint-desktop` at runtime, so the
  hook and the variant can never drift apart.

Column widths are **fixed per breakpoint** (never content-driven): the order
sidebar is a fixed-width column that is simply narrower in compact mode, set
via `--sidebar-width` in `OrderWorkspace`. The shadcn sidebar is pinned to
desktop mode (no mobile Sheet overlay) since this is a desktop-only app.

Styling lives in Tailwind utilities on the components, with one deliberate
exception: **global element typography** (`h1`/`h2`/`h3`/`p` via `@apply` in
`src/index.css`) sets the app-wide type scale — original sizes at `desktop:`,
one step smaller below. Utility classes on a tag override it per site.
Legacy plain-CSS rules (remnants from before Tailwind was introduced) are
being eliminated — don't add new ones, and when you touch code that depends
on one, replace it with utilities.

**Global dialogs:** [`NewOrderDialog`](src/components/NewOrderDialog.tsx),
[`CustomerDialog`](src/components/CustomerDialog.tsx),
[`DuplicateDialog`](src/components/DuplicateDialog.tsx).
Simple confirmations (archive/cancel/delete/mark-done prompts) go through the
promise-based `useConfirm()` hook from
[`ConfirmDialog`](src/components/ConfirmDialog.tsx) (`ConfirmProvider` is
mounted in `App.tsx`) — don't use `window.confirm` or one-off confirm dialogs.
[`HistoryPanel`](src/components/HistoryPanel.tsx) shows order history;
[`FileList`](src/components/FileList.tsx) the order-wide file links.

**Auth:** [`Login`](src/components/Login.tsx) calls
`supabase.auth.signInWithPassword`; without a session the app renders only the
login layout.

**Full-page routes:** `StampStockPage` ([src/pages/StampStockPage.tsx](src/pages/StampStockPage.tsx))
— stamp inventory; `TextileStockPage` ([src/pages/TextileStockPage.tsx](src/pages/TextileStockPage.tsx))
— textile master data + variant stock. [`OrderWorkspace`](src/pages/OrderWorkspace.tsx)
hosts the three-column shell.

## Production Departments (`department` enum)

Every order has 1…n jobs, each assigned to one production department.
Enum `department`: `LFP`, `COPYSHOP`, `TEXTILE`, `STAMP`, `LASER_ENGRAVING`,
`OTHER`. Each has a detail mask under `src/components/departments/` and a
validator under `src/lib/<dept>/`.

| Department | Component |
|---------|-----------|
| LFP (Großformatdruck) | [`LFPDetail.tsx`](src/components/departments/LFPDetail.tsx) |
| CopyShop | [`CopyShopDetail.tsx`](src/components/departments/CopyShopDetail.tsx) |
| Textile | [`TextileDetail.tsx`](src/components/departments/TextileDetail.tsx) |
| Stamp | [`StampDetail.tsx`](src/components/departments/StampDetail.tsx) |
| Laser | [`LaserDetail.tsx`](src/components/departments/LaserDetail.tsx) |
| Other | [`OtherDetail.tsx`](src/components/departments/OtherDetail.tsx) |

## Domain Model

- **Customer** — table `customers` (`name`, `email`, `phone`, `note`, address,
  `is_archived`). Created/edited via `CustomerDialog`; searched by `ilike` on
  `name` (only `is_archived = false`).
- **Order** — table `orders` (`customer_id`, `status`, `deadline`, `delivery`
  (`PICKUP`|`SHIPPING`), `priority` (`HIGH`|`NORMAL`),
  `is_erp_exported`, `is_archived`, `created_at`). Status kept in sync via
  `orderService.recalculateOrderStatus` (TS `calculateOrderStatus`). Has 1…n
  jobs.
- **Job** — table `jobs` (the per-department production unit; formerly
  "sub-order" / `department_orders`). Carries `job_number`
  (`<order_number>-<DEPT>-<NN>`, assigned by DB trigger
  `fn_generate_job_number`, never by the client), `department`, `type`,
  `status`, schedule fields, `assignee_id`, `is_cancelled`,
  customer-approval fields. It still has its own legacy `detail`
  JSONB + `type` + type-check trigger (used by Textile's `eigenware_modus` and
  the type guard) — a later cleanup, out of scope of the product redesign.
- **Time logs** — table `job_time_logs`: worked-time entries per job
  (`minutes` > 0, `created_at`). `user_id` = the employee the time is
  attributed to; `created_by` = who wrote the row. Employees log as
  themselves; only admins may log on someone else's behalf or delete a log
  (RLS-enforced). The job's total time is `SUM(minutes)` over its logs —
  there is no aggregate column. Every create/delete writes a history event
  (`TIME_LOGGED` / `TIME_LOG_DELETED`, actor in `user_id`, attributed
  user + minutes in `meta`). UI:
  [`JobTimeLogs`](src/components/JobTimeLogs.tsx) in the job detail;
  service [`timeLogService`](src/services/timeLogService.ts).
- **Files** — table `files` (`order_id`, `display_name`, `role`, …). Attached at
  the **order** level, loaded in `WorkArea`, selectable for customer approval in
  `ContextPanel`. UNC-path **linking**, not upload.
- **Products** — see below (the typed per-type model).
- **Textile** — relational, not in the product hierarchy: `textile_brands` →
  `textile_products` → `textile_variants` (master data, with `color_hex`,
  `stock`, `min_stock`); plus `textile_motifs`, `textile_positions`,
  `textile_assignments` (per-order); `textile_stock_movements`. Eigenware mode
  (`STAMMDATEN` | `FREITEXT`) lives in the job detail.

### Products — typed per-type tables (post-refactor)

Products no longer use a JSONB `detail` blob. The model is supertype/subtype
(class-table inheritance):

- **Parent `department_products`** — `id`, `job_id`, `department`,
  `type` (discriminator), `quantity`, `notes`, `sort_order`, `created_at`.
- **One typed child table per product type** (30 total: 7 CopyShop, 9 Stamp,
  8 LFP, 5 Laser, 1 Other), PK = FK to `department_products`
  (`department_product_id`), holding that type's English spec columns. The
  `type` value selects the child (e.g. `POSTER` → `poster_products`,
  `TRODAT_PRINTY` → `trodat_printy_products`). Textile is **not** in this
  hierarchy.
- **`product_files`** — M:N file links on the parent (`department_product_id` →
  `department_products`, `file_id` → `files`).

**Code contract:** [src/types/product.ts](src/types/product.ts) defines
`LoadedProduct` (parent + typed `child`), `ProductWriteInput`, the `ChildTable`
union, and `childTableForType()`.
[`departmentProductService`](src/services/departmentProductService.ts) is the only
product service: `getProductsByJobId` (parent + child), `createProduct` /
`updateProduct` (TS two-step — insert/update parent then child, no RPC),
`deleteProduct` (cascade), and the `product_files` helpers. Per-department
validators (`src/lib/<dept>/validate*Detail.ts`) are pure functions over the
typed fields. The detail components hold a flat English form object and split it
into parent (`type`/`quantity`/`notes`) + typed child via a `buildChild`-style
mapper on save.

### Status (Order & Job)

Flow: `QUOTE` → `INCOMPLETE` → `PREPRESS_READY` → `PRODUCTION_READY` → `DONE`
(orders may also reach `INVOICED`).

- **Aggregate order status is derived from the jobs** by
  `calculateOrderStatus` ([src/lib/orderStatus.ts](src/lib/orderStatus.ts)) — the
  lowest status across non-cancelled jobs. `orderService.recalculateOrderStatus`
  reads the order + jobs, computes this, and writes `orders.status`. (This
  was formerly a Postgres RPC; it now lives entirely in the client/service layer.)
- **Per-job transitions** are governed by the completeness logic in
  [src/lib/jobShared.ts](src/lib/jobShared.ts) (`isJobComplete`,
  `autoPrepressAllowed`), the automatic-status logic under `src/lib/status/`
  (driven by [src/queries/useStatusManager.ts](src/queries/useStatusManager.ts)),
  and the per-department validators (`OTHER_STAMP`, `OTHER_LFP`, `OTHER_LASER`,
  and the `OTHER` department are auto-prepress-ineligible — manual only).
- **`ContextPanel`** is the single point of manual workflow control: set status,
  ERP insert, archive, write `history` entries. Admins can additionally
  force-release an incomplete job to production via `JobReleaseButton`
  (bypasses the completeness gate; recorded as an `EMERGENCY_TRIGGERED`
  history entry with a required reason).

## Workflow specifics

- **Release to production** (`PREPRESS_READY` → `PRODUCTION_READY`) books
  **automatic stock deductions** (only here, not on "mark done") via the
  `book_production_deductions` RPC — one transaction, row-locked conditional
  decrements, `AUTO_DEDUCTION` movement rows with a note incl. the order number:
  - **STAMP:** stamp-model products decrement their model (plus the matching
    replacement pad for a catalog ink colour); `TRODAT_PAD` products decrement
    their pad variant.
  - **TEXTILE:** every own-stock garment with a set `variant_id` decrements the
    variant by the product quantity.
  - Insufficient stock **blocks the release** (red banner + disabled release
    button while in pre-press, and the RPC rejects atomically if a concurrent
    release consumed the stock first). The admin **force release** bypasses the
    shortage: stock is floored at 0 and movements record what was actually
    deducted.
- **Customer approval** blocks only *release to production* (cancel/delete have
  their own busy flags).
- **ERP export** — `erp_exports` (`order_id`, `mode` (`SINGLE`|`BULK`),
  `export_data`).
- **Duplicate order** — RPC `duplicate_order` deep-copies an order (jobs,
  products incl. the typed child by `type`, `product_files`, textile rows) in one
  transaction; called from [`DuplicateDialog`](src/components/DuplicateDialog.tsx).

## Key Files (selection)

| Path | Role |
|------|------|
| [`src/types/product.ts`](src/types/product.ts) | Typed product model: `LoadedProduct`, `ProductWriteInput`, `ChildTable`, `childTableForType()` |
| [`src/types/database.ts`](src/types/database.ts) | App-facing row/enum aliases over the generated `supabase.ts` |
| [`src/types/supabase.ts`](src/types/supabase.ts) | Generated DB types (regenerate after migrations) |
| [`src/services/departmentProductService.ts`](src/services/departmentProductService.ts) | Product CRUD (parent + typed child), file links |
| [`src/services/orderService.ts`](src/services/orderService.ts) | Orders, list, `recalculateOrderStatus`, `duplicate_order` |
| [`src/services/jobService.ts`](src/services/jobService.ts) | Jobs (table `jobs`) |
| [`src/services/textileService.ts`](src/services/textileService.ts) / [`textileMasterDataService.ts`](src/services/textileMasterDataService.ts) | Textile per-order + master data |
| [`src/services/historyService.ts`](src/services/historyService.ts) | History events |
| [`src/lib/jobShared.ts`](src/lib/jobShared.ts) | Cross-cutting completeness (`isJobComplete`, `autoPrepressAllowed`) |
| [`src/lib/pdf/orderPdf.ts`](src/lib/pdf/orderPdf.ts) | PDF production sheet (German output is intentional) |
| [`.plans/DB_RENAME_MAP.md`](.plans/DB_RENAME_MAP.md) | German→English schema map (authoritative) |

## Notes for Developers

- The application architecture (three-column shell, per-department modules,
  server-derived aggregate status, file linking instead of upload, products as
  parent + typed child tables) is fixed; no restructuring intended.
- The colour system is centralised in `src/index.css` as CSS variables — consume
  the tokens, don't hardcode colours.
- **Open refactor streams** (see `.plans/`): value-rename of stored enum strings
  to English; the i18next UI-string pass; per-type Zod validation schemas (to
  replace the per-department validators). Don't fold these into unrelated work.
- For current status / known debt see [current_state.md](current_state.md).
