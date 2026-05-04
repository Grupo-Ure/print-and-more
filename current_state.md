# Current State

As of **2026-05-04** — merged from the former `Systemstand.md` and the
hand-over PDF (`README_Auftragssystem.pdf`).

This file describes the **current implementation status**: what is done,
what is open, and which known gaps are documented. The stable architecture
and workflow description lives in [README.md](README.md).

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

- Stempel and Textil stock deductions on production release (`ContextPanel`:
  `ausfuehrenProduktionFrei`) run as sequential client-side DB calls
  **without a transaction** — partial failure leaves inconsistent state.
  Candidate for an RPC refactor analogous to order duplication.
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
