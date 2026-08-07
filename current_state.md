# Current State

As of **2026-05-15**.

This file describes the **current implementation status**: what is done,
what is open, and which known gaps are documented. The stable architecture
and workflow description lives in [README.md](README.md).

## Context

The project was originally handed over by the client as a finished system
with only the UI left to build. That framing has not held up under
inspection. Ownership of the full project — frontend, backend, schema,
operations — now sits with the in-house developer, and the codebase is
broadly in a messy state: prior "complete" statuses below were the
client's assessment, not a verified one, and should be treated as
**claimed-complete pending review** rather than trusted.

A separate translation pass (German → English in prose, comments, and
docs; identifiers stay German) is largely done and continues
opportunistically as remnants surface — it is no longer the active
workstream.

## Active Focus

**Structural refactor of the home page** — the three-column shell in
[`src/App.tsx`](src/App.tsx) and its three children:
[`OrderSidebar`](src/components/OrderSidebar.tsx) (left),
[`WorkArea`](src/components/WorkArea.tsx) (centre), and
[`ContextPanel`](src/components/ContextPanel.tsx) (right).

Goals for this pass:

1. **Reusability** — extract shared pieces, collapse duplication.
2. **Standard tools over bespoke logic** — prefer well-known libraries
   (TanStack Query is already installed; `src/queries/` is where extracted
   query logic is landing) instead of hand-rolled hooks, stores, and
   effect chains.
3. **Comprehension** — read deeply while refactoring; the refactor
   doubles as the developer's onboarding to a codebase they did not write.

Wider refactor of the rest of the app will follow once the home page is
on stable footing.

## Status Overview

| Area | Status |
|------|--------|
| Business logic & workflows | Complete |
| Database schema & RLS | Complete |
| Inventory (Stempel, Textil) | Complete |
| TypeScript types | Generated from Supabase schema |
| Tailwind / CSS variables | Set up |
| Code audit (critical & medium) | Done |
| UI implementation | Open |
| Lasergravur Bereich | Spec pending |
| Server migration | Future task |

## Production Departments

| Bereich | Status |
|---------|--------|
| Großformatdruck (LFP) | Complete |
| CopyShop | Complete |
| Textil | Complete |
| Stempel | Complete |
| Lasergravur | Spec pending |
| Sonstige | Complete |

## Feature Set (fully implemented)

- Full order lifecycle: create → prepress → production → done
- Customer management with address fields
- File management (UNC-path linking, no upload)
- Customer approval workflow
- Emergency / priority flagging
- Stempel inventory with automatic deductions on production release
- Textil inventory with variant tracking (Marke / Produkt / Farbe / Größe)
- History logging, atomic order duplication (PostgreSQL RPC)
- Reorder list based on open orders vs. stock
- Supabase RLS policies on all tables
- TypeScript types generated from the Supabase schema

## Schema Tables Not Yet Wired Up

Present in the generated Supabase schema but **not actively used by the
client**: `produkt_dateien`, `profile`, `auftragsnummer_counter`.

## Known Gaps & Open Items

Informational — none are blockers. The order and priority of these is up to
the implementer.

### Code Quality / TypeScript

- 48 ESLint `react-hooks/set-state-in-effect` warnings across multiple
  components — best cleaned up alongside a UI refactor that already touches
  those files.
- Several `as unknown as` casts in
  [`TextilDetail.tsx`](src/components/bereiche/TextilDetail.tsx) — caused by
  Supabase-generated embed types; not trivially resolvable without
  regenerating types.
- `tsconfig.app.json`: `exactOptionalPropertyTypes` is disabled — enabling it
  may surface additional type errors.
- `meta` fields in `ContextPanel` use `as unknown as Record` for history
  entries.

### Architecture / Transactions

- ~~Stamp and textile stock deductions on production release run as sequential
  client-side DB calls without a transaction~~ — **done**: the
  `book_production_deductions` RPC books them atomically (conditional
  decrement + movement rows in one transaction), insufficient stock blocks the
  release (UI shortage banner/row highlights via
  `productionReleaseService.checkStockAvailability`), and admin force release
  deducts floored at 0.
- `BestandspflegeSeite` and `TextilBestandSeite`: booking operations
  (`bestand` update + `lager_bewegungen` insert) are not atomic — same
  pattern as above.
- `TextilBestandSeite`: reorder-list loading uses chunked sequential
  queries — potential performance issue as data grows.
- `KUNDENFREIGABE_DEAKTIVIERT` does not exist as a DB enum value — currently
  mapped to `KUNDENFREIGABE_VERFALLEN` with `meta.aktiv` for disambiguation.
- **RLS / schema in Supabase** must cover the columns, tables, and RPC the
  client uses; the repo contains **no** migration files.

### UX

- Login button has no busy/disabled state — double-click is possible.
- `App.tsx` renders `null` during auth loading — no loading indicator.
- Toast system uses `setTimeout` without `clearTimeout` on unmount.
- `DateiListe`: `file://` path navigation (open in Explorer / Finder) is
  unreliable in browsers — slated for a later Electron migration.
- Several action buttons in detail views are not disabled during in-flight
  requests.
- Aggregated `auftraege.status` in the **left list** does not refresh live
  when changes are made only in the centre column; switching selection or a
  refetch (e.g. `orderListKey` after archiving, a new order, or a customer
  change) updates it.

## Roadmap / Larger Open Themes

- **UI implementation** — a Figma mockup is available as reference; not a
  pixel-perfect spec, with creative freedom for a professional desktop tool.
- **Lasergravur Bereich** — spec pending; minor addition once the team
  provides requirements.
- **Server migration** — Supabase Cloud → self-hosted on Windows Server
  (separate, future task).
