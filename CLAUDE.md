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

> This file is also the project's `CLAUDE.md` (symlinked) — the conventions
> below apply to AI assistants working in this repo as well as to human
> contributors.

## Working with this project

**Language**

- All documentation, comments, commit messages, PR descriptions, and other
  prose must be written in **English**. The project owner is not German.
- The **codebase itself is German** — table names, enum values (`ANGEBOT`,
  `PREPRESS_BEREIT`, `FERTIG`, …), domain nouns (`Auftrag`, `Teilauftrag`,
  `Kunde`, `bereich`), file names, and UI labels — and stays German. Do not
  translate identifiers that exist in the source. When mentioning a German
  identifier in English prose, use it as-is (e.g. "the `Auftrag` header").
- Existing files written in German may be left as-is; switch to English only
  when creating or substantially rewriting something.

**Issue tracking**

Work for this project is tracked in **Jira**, in the project/space called
**Markus**. When asked to check tasks, tickets, or work items, look there
first — no further disambiguation is needed.

**Where things go**

- **README.md** (this file) — stable architecture, domain model, workflows.
  No version pins, no pixel widths, no current-state info.
- **[current_state.md](current_state.md)** — moving-target stuff: what's
  done, what's pending, known technical debt.
- **`package.json`** is the source of truth for library versions; CSS files
  are the source of truth for UI dimensions. Don't duplicate those values
  into prose.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + CSS variables (colour system in `index.css`)
- **Backend:** Supabase — PostgreSQL with Auth and Row-Level Security; RLS policies live in Supabase, not in this repo
- **Client:** [src/supabase.ts](src/supabase.ts) (`createClient`)
- **Target platform:** desktop browser

## UI Layout ([App.tsx](src/App.tsx))

Three-column layout, full height:

| Column | Component | Role |
|--------|-----------|------|
| Left   | [`OrderSidebar`](src/components/OrderSidebar.tsx) | "+ Neuer Auftrag" button (opens `NeuerAuftragDialog`); order list with selection; archived orders excluded (`.eq('archiviert', false)`) |
| Centre | [`WorkArea`](src/components/WorkArea.tsx) | Order header, files, sub-order tabs, active sub-order detail mask |
| Right  | [`ContextPanel`](src/components/ContextPanel.tsx) | Status, workflow actions, hints (Auftrag and Teilauftrag workflow) |

**Shared state in `App`:** `aktiverAuftragId`, `aktiverAuftrag` (full Auftrag
including header fields, `kunden` join, `erp_exportiert`, `archiviert`),
`aktiverTeilauftrag`, `auftragKunde`, `auftragDateien`, `kontextAktualisiert`
(triggers a refetch in `WorkArea` after actions in the context),
`orderSidebarKey` (remount/refresh of `OrderSidebar` after archiving, creating a new
order, or saving a customer), `neuerAuftragOffen` (modal flag), `kundeDialog`
(edit via `KundeDialog`).

`WorkArea` synchronises back to the context via callbacks:
`onAuftragVomArbeitsbereich`, `onAuftragKundeGeladen`,
`onAktiverTeilauftragGeaendert`, `onAuftragDateienGeaendert`,
`onKundeBearbeiten` (opens `KundeDialog` with the customer from `auftragKunde`
or the join).

**Global dialogs (mounted in `App`):** `NeuerAuftragDialog` (create order),
`KundeDialog` (edit customer — invoked from the `WorkArea` pencil icon or the
`ContextPanel` while an Auftrag is in `ANGEBOT`). On success: bump
`orderListKey`, optionally `kontextAktualisiert`, and `setAktiverAuftragId`
for a newly created Auftrag.

**Auth:** `Login` calls `supabase.auth.signInWithPassword`; the session type
is `Session | null`. Without a session the app renders only the login layout.

**Full-page routes (outside the three-column shell):**
`/bestandspflege` → [`BestandspflegeSeite`](src/pages/BestandspflegeSeite.tsx)
(stamp inventory); `/textil-bestand` →
[`TextilBestandSeite`](src/pages/TextilBestandSeite.tsx) (textile master data
and variant stock). Both are opened from `ContextPanel` in a new tab.

## Production Departments (Teilauftrag-Bereiche)

Every `Auftrag` has 1…n `Teilaufträge`, each assigned to one production
department (`bereich`). Each department has a detail mask under
`src/components/bereiche/` and a validator under `src/lib/<bereich>/`.

| Bereich | Component |
|---------|-----------|
| Großformatdruck (LFP) | [`LFPDetail.tsx`](src/components/bereiche/LFPDetail.tsx) |
| CopyShop | [`CopyShopDetail.tsx`](src/components/bereiche/CopyShopDetail.tsx) |
| Textil | [`TextilDetail.tsx`](src/components/bereiche/TextilDetail.tsx) |
| Stempel | [`StempelDetail.tsx`](src/components/bereiche/StempelDetail.tsx) |
| Lasergravur | [`LaserDetail.tsx`](src/components/bereiche/LaserDetail.tsx) |
| Sonstige | [`SonstigeDetail.tsx`](src/components/bereiche/SonstigeDetail.tsx) |

## `ContextPanel` ([src/components/ContextPanel.tsx](src/components/ContextPanel.tsx))

- **Status section:** colour-coded badges for Auftrag and (where applicable)
  Teilauftrag status; an **NOTFALL** banner with `notfall_begruendung` when
  `notfall_aktiv` is set.
- **Aktionen section (excerpt):** order-level workflow — in `ANGEBOT` e.g.
  *In Bearbeitung nehmen* alongside *Kunde bearbeiten* (`onKundeBearbeiten`);
  *ERP exportieren* with mode, *Archivieren*. Teilauftrag workflow: release
  prepress / production, mark done, raise emergency, toggle and grant
  customer approval, cancel, delete. **Customer approval** blocks only
  *Produktion freigeben* (`prodDisabled`); cancel and delete have their own
  busy flags (`stornoLaeuft` / `loeschenLaeuft`) and are not gated by the
  global `busy` lock.
- **Produktion freigeben** (`PREPRESS_BEREIT` → `PRODUKTION_BEREIT`): after
  the status update succeeds, **automatic stock deductions** are booked here
  (and only here, not on Fertig melden):
  - **STEMPEL:** decrement stamp- and (where relevant) Stempelkissen-stock,
    insert a `lager_bewegungen` row with `typ: 'AUTOABGANG'` and a note
    "Automatisch bei Produktionsfreigabe …" plus the Auftragsnummer. Before
    the release dialog: a warning modal if stamp- and/or Kissen-stock is
    **0**.
  - **TEXTIL:** every `textil_position` of the Teilauftrag with
    `herkunft = 'EIGENWARE'` and a set `variante_id` reduces the variant's
    `bestand` by the position's `stueckzahl` (floored at 0); each non-zero
    deduction is logged in **`textil_lager_bewegungen`** (`AUTOABGANG`,
    same note format).
- **Fertig melden** (`PRODUKTION_BEREIT` → `FERTIG`): no stamp-stock
  deduction, no stock check that would block FERTIG.
- **Hinweise section:** context-aware messages (pending customer approval,
  emergency state, ERP not yet exported, …).
- **Supabase calls** include `schreibeHistorie`
  ([src/lib/historie.ts](src/lib/historie.ts)) and
  `synchronisiereAuftragsstatus` via the RPC `fn_berechne_auftragsstatus`
  ([src/lib/auftragsStatus.ts](src/lib/auftragsStatus.ts)). `auftraege`
  selects use `AUFTRAG_SPALTEN`
  ([src/const/auftragSelect.ts](src/const/auftragSelect.ts)) including
  `kunden(id, name, email, telefon, notiz)`.

`ContextPanel.css` — styles for sections, badges, and modals.

## `WorkArea` ([src/components/WorkArea.tsx](src/components/WorkArea.tsx)) — top-to-bottom flow

1. **Order header:** customer name with a pencil icon "Kunde bearbeiten"
   (`onKundeBearbeiten`); Auftragsnummer; Auftragsstatus. **Inline-editable**
   fields with `onBlur` save: `termin` (optional date), `lieferung`
   (`ABHOLUNG` / `VERSAND` / empty), `prioritaet` (e.g. `NORMAL` / `HOCH`,
   with `NIEDRIG` shown if present in DB). Update writes to `auftraege`.
2. **Dateien** ([`DateiListe`](src/components/DateiListe.tsx)): order-wide
   file links; UI title "Dateien".
3. Divider.
4. **Teilauftrag tabs** (cancelled rows hidden) plus a **+** button
   ([`AddTeilauftragOverlay`](src/components/AddTeilauftragOverlay.tsx)).
5. **Active detail** ([`TeilauftragDetail`](src/components/TeilauftragDetail.tsx)
   per `bereich`).

**Centralised file state:** `dateien: Datei[]`, `dateienLaden`,
`reloadDateien()`; reloads on `aktiverAuftragId` change and when `App` raises
`kontextAktualisiert`.

**Data load:** `ladeAuftragUndTeilauftraege(auftragId)` reads `auftraege`
using `AUFTRAG_SPALTEN` (incl. `kunden(id, name, email, telefon, notiz)`,
`termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `erstellt_am`,
`erp_exportiert`, `archiviert`) plus `teilauftraege` (full
`TEILAUFTRAG_SPALTEN`); the first non-cancelled tab is selected, or the
previously active id if still valid.

**New Teilauftrag (insert):** defaults include `notfall_aktiv: false`,
`storniert: false`, customer-approval fields off — see `WorkArea`.

## Key Files (selection)

| Path | Role |
|------|------|
| [`src/types/database.ts`](src/types/database.ts) | `Auftrag` / `AuftragDetailRow` incl. `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert`; `KundeKontaktRow` incl. `id`, `notiz`; `TeilauftragRow` incl. emergency, cancel, customer approval; enums; `TEILAUFTRAG_BEREICHE` / `teilauftragBereichLabel()` |
| [`src/lib/historie.ts`](src/lib/historie.ts) | `schreibeHistorie()`, `HistorieEreignis` |
| [`src/lib/auftragsStatus.ts`](src/lib/auftragsStatus.ts) | `synchronisiereAuftragsstatus(auftragId)` → RPC + update of `auftraege.status` |
| [`src/const/teilauftragSelect.ts`](src/const/teilauftragSelect.ts) | `TEILAUFTRAG_SPALTEN` (see below) |
| [`src/const/auftragSelect.ts`](src/const/auftragSelect.ts) | `AUFTRAG_SPALTEN` — `auftraege` plus customer join, used uniformly by `WorkArea`, `ContextPanel`, `auftragsStatus` |
| [`src/lib/kunden.ts`](src/lib/kunden.ts) | `Kunde` (table type), `kontaktJoinZuKunde()` |
| [`src/components/NeuerAuftragDialog.tsx`](src/components/NeuerAuftragDialog.tsx) | New order: customer search, `KundeDialog`, insert into `auftraege` (`kunde_id`, status `ANGEBOT`, optional Termin / Lieferung / Priorität) |
| [`src/components/KundeDialog.tsx`](src/components/KundeDialog.tsx) | Create/edit Kunde (`kunden` insert/update) |
| [`src/types/lfp.ts`](src/types/lfp.ts) | LFP sub-types, `LfpDetailJson` |
| [`src/types/copyshop.ts`](src/types/copyshop.ts) | CopyShop sub-types, `CopyShopDetailJson` |
| [`src/types/textil.ts`](src/types/textil.ts) | Textil enums, row types (Motive, Positionen, Zuordnungen) |
| [`src/lib/kunde.ts`](src/lib/kunde.ts) | `kundenName()`; `kundeErfuelltPrepressKontakt()` |
| [`src/lib/teilGlobal.ts`](src/lib/teilGlobal.ts) | Global mandatory-field validation, `istTeilAuftragVollstaendig`, `nextTeilStatus` incl. `automatischesPrepressErlaubt()` (e.g. `SONSTIGE_STEMPEL` is manual-only; STEMPEL covers the new typen) |
| [`src/lib/lfp/validateLfpDetail.ts`](src/lib/lfp/validateLfpDetail.ts) | LFP `detail` validation |
| [`src/lib/copyshop/validateCopyShopDetail.ts`](src/lib/copyshop/validateCopyShopDetail.ts) | CopyShop `detail` |
| [`src/lib/stempel/validateStempelDetail.ts`](src/lib/stempel/validateStempelDetail.ts) | Stempel `detail` |
| [`src/lib/sonstige/validateSonstigeDetail.ts`](src/lib/sonstige/validateSonstigeDetail.ts) | Sonstige `detail` |
| [`src/lib/laser/validateLaserDetail.ts`](src/lib/laser/validateLaserDetail.ts) | Laser `detail` |
| [`src/lib/textil/validateTextilDetail.ts`](src/lib/textil/validateTextilDetail.ts) | Textil: `textil.voll` / table logic |
| [`src/App.tsx`](src/App.tsx) | Layout, shared state, mounts `OrderSidebar` / `WorkArea` / `ContextPanel` |
| [`src/components/OrderSidebar.tsx`](src/components/OrderSidebar.tsx) | `auftraege` (join `kunden(name)`); "+ Neuer Auftrag"; selection / active row; archived filter |
| [`src/components/ContextPanel.tsx`](src/components/ContextPanel.tsx) | Right column: status, actions, history integration |
| [`src/components/WorkArea.tsx`](src/components/WorkArea.tsx) | Auftrag, Teilaufträge, file state, `DateiListe`, tabs, callbacks for the context panel; cancelled rows hidden from tabs |
| [`src/components/DateiListe.tsx`](src/components/DateiListe.tsx) | Files UI; exports `Datei` type |
| [`src/components/TeilauftragDetail.tsx`](src/components/TeilauftragDetail.tsx) | Cross-cutting Teilauftrag fields; dispatches per-Bereich; passes `auftragDateien` to e.g. Textil |
| [`src/components/bereiche/TextilDetail.tsx`](src/components/bereiche/TextilDetail.tsx) | Textil tables; `detail.textil` plus status; Eigenware **STAMMDATEN** (Marke / Produkt / Farbe + Größe → `variante_id`, joined fields) vs **FREITEXT**; `detail.eigenware_modus` (`STAMMDATEN` \| `FREITEXT`); colours from `textil_varianten.farbe_hex` |
| [`src/pages/BestandspflegeSeite.tsx`](src/pages/BestandspflegeSeite.tsx) | Stamp inventory page (own route) |
| [`src/pages/TextilBestandSeite.tsx`](src/pages/TextilBestandSeite.tsx) | Textile master data (Marken / Produkte / Varianten), stock, reorder list (own route) |
| [`src/components/AddTeilauftragOverlay.tsx`](src/components/AddTeilauftragOverlay.tsx) | Add Teilauftrag |
| [`src/components/Login.tsx`](src/components/Login.tsx) | Login form |

## Domain Model (in brief)

- **Kunde** — table `kunden` (`name`, `email`, `telefon`, `notiz`,
  `archiviert`, …). Created/edited via `KundeDialog`. `NeuerAuftragDialog`
  searches by free-text `ilike` on `name` (only `archiviert = false`). Joined
  on order rows as `KundeKontaktRow` (incl. `id`, `notiz`) for display and
  forms.
- **Auftrag** — `kunde_id` → Kunde, `status` (kept in sync via
  `fn_berechne_auftragsstatus`). Header: optional `termin`, `lieferung`
  (`ABHOLUNG` \| `VERSAND`), `prioritaet` (e.g. `NORMAL` \| `HOCH`),
  `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert`.
  Has 1…n **Teilaufträge**. New orders are created from `NeuerAuftragDialog`
  with status `ANGEBOT`. Centre and right columns read/update `auftraege`
  including the customer join.
- **Dateien** — attached at the **Auftrag** level (`dateien.auftrag_id`),
  loaded centrally in `WorkArea`, selectable for customer approval in
  `ContextPanel`. UNC-path linking, **not upload**.
- **Teilauftrag** — per-department production unit. Carries `bereich`,
  `typ`, `status`, schedule fields, `verantwortlicher_id`,
  `satzzeit_minuten`, emergency fields (`notfall_aktiv`,
  `notfall_begruendung`), `storniert`, customer-approval fields, plus a
  `detail` JSONB column whose shape is per-`bereich` (validated by
  `src/lib/<bereich>/validate*Detail.ts`). **TEXTIL** uses the related
  tables `textil_motive`, `textil_positionen`, `textil_zuordnungen`;
  `detail.eigenware_modus` switches Eigenware between `STAMMDATEN` and
  `FREITEXT`. Positions can carry a `variante_id` (FK to
  `textil_varianten`).

### Status (Auftrag & Teilauftrag)

Order: `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` →
`PRODUKTION_BEREIT` → `FERTIG`.

- **Aggregate Auftrag status is server-derived**: the client calls
  `synchronisiereAuftragsstatus()`, which invokes `fn_berechne_auftragsstatus`
  and writes the result back to `auftraege.status`. The client never composes
  the aggregate locally.
- **Per-Teilauftrag transitions** are governed by `nextTeilStatus()` in
  [`teilGlobal`](src/lib/teilGlobal.ts) and the per-Bereich validators.
- **`ContextPanel`** is the single point of manual workflow control: set
  status, toggle emergency, trigger ERP insert, archive, write history
  entries.

### Teilauftrag-Bereich (enum `teilauftrag_bereich`)

DB enum strings; display labels via `teilauftragBereichLabel()`.

## Teilauftrag — Columns & Persistence (Client)

**`TEILAUFTRAG_SPALTEN`:**
`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `lieferung`,
`prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, `detail`,
`notfall_aktiv`, `notfall_begruendung`, `storniert`,
`kundenfreigabe_erforderlich`, `kundenfreigabe_liegt_vor`,
`kundenfreigabe_datei_id`.

- **Auftrag in the work area / context:** see `AUFTRAG_SPALTEN` —
  `kunden(id, name, email, telefon, notiz)`, `termin`, `lieferung`,
  `prioritaet`, `notfall_aktiv`, `erstellt_am`, `erp_exportiert`,
  `archiviert` ([src/const/auftragSelect.ts](src/const/auftragSelect.ts)).

## Supabase — Tables and Functions

Actively used by the client:

- **`kunden`** — `insert` / `update` / name search from `NeuerAuftragDialog` /
  `KundeDialog`.
- **`auftraege`** — incl. `kunde_id`, `status`, `termin`, `lieferung`,
  `prioritaet`, `notfall_aktiv`, `erp_exportiert`, `archiviert`, plus
  `kunden(…)` join.
- **`teilauftraege`** — full `TEILAUFTRAG_SPALTEN`.
- **`dateien`** — `id`, `auftrag_id`, `anzeigename`, `rolle`, …
- **`historie`** — events with `ereignisart`, `person_id` (auth user),
  optional `teilauftrag_id`, `begruendung`, `meta`.
- **`erp_exporte`** — `auftrag_id`, `modus` (`EINZELN` \| `GESAMMELT`),
  `exportdaten` (JSON), …
- **`textil_motive`**, **`textil_positionen`**, **`textil_zuordnungen`** —
  Textil detail. `textil_positionen` optionally carries `variante_id` (UUID)
  for Eigenware sourced from master data.
- **`textil_marken`**, **`textil_produkte`**, **`textil_varianten`** —
  Textil master data (variants carry `farbe_hex`, `bestand`,
  `mindestbestand`); used by `TextilBestandSeite` and Eigenware-Stammdaten in
  `TextilDetail`.
- **`textil_lager_bewegungen`** — per-variant stock movements
  (`variante_id`, `typ`, `menge`, `notiz`, `person_id`).
- **`stempel_modelle`** — master data for **model suggestions** in the
  Stempel domain (`id`, `name`, `typ`, `max_breite_mm`, `max_hoehe_mm`,
  `druckflaeche`, `bestand`, `aktiv`, …); RLS active, access for
  `authenticated`.
- **`lager_bewegungen`** — Stempel stock movements (auto-deductions on
  production release plus manual bookings from Bestandspflege).
- **`mitarbeiter`** — `id`, `email` (Verantwortlicher).
- **RPC `fn_berechne_auftragsstatus(p_auftrag_id)`** — returns the target
  aggregate status; the client writes it back to `auftraege.status` via
  `synchronisiereAuftragsstatus`.

## STEMPEL Bereich — Detail Mask & Logic

### Typen (`teilauftraege.typ`)

`TRODAT_PRINTY`, `HOLZSTEMPEL`, `STATIVSTEMPEL`, `DATUMSSTEMPEL`,
`SONSTIGE_STEMPEL`, `NACHFUELLFARBE`, `STEMPELKISSEN`, `STEMPELPLATTE`.

### `detail` (JSONB) shape — selected fields

- **Format size (OR-mandatory):** `detail.format_breite`,
  `detail.format_hoehe` (positive integer; at least one must be set).
  - Required for all typen **except** `NACHFUELLFARBE` and `STEMPELKISSEN`.
- **Model selection (only `TRODAT_PRINTY` / `HOLZSTEMPEL`):**
  `detail.modell_id`, `detail.modell_name`.
- **`NACHFUELLFARBE`:** `detail.farbe` (no `SONSTIGE`),
  `detail.tinte_typ` (`NORMAL` | `HAUTVERTRAEGLICH` | `TEXTIL`),
  quantity (see below), optional `detail.hinweis`.
- **`STEMPELKISSEN`:** `detail.groesse` (`KLEIN` | `MITTEL` | `GROSS`),
  `detail.farbe` (no `SONSTIGE`), quantity, optional `detail.hinweis`.
- **Classic stamp typen:** `detail.farbe` (incl. `SONSTIGE` plus
  `detail.farbe_sonstige`), `detail.beschreibung`.

**Quantity field name:** the validator accepts either `detail.anzahl` or
`detail.stueckzahl` (the UI persists `stueckzahl` and re-labels per typ).

### Modellvorschlag (`TRODAT_PRINTY` / `HOLZSTEMPEL`)

- Query: `stempel_modelle` filtered by `typ`, `aktiv = true`, and
  `gte(max_*)` for each given dimension.
- Display: full result list; selection persists (badge "Gewählt: …" plus
  list highlight). Models with `bestand = 0` are flagged orange but remain
  selectable.
- UI sort:
  1. **Exact matches first** (both dimensions equal),
  2. then by combined slack: \(|max\_breite - breite| + |max\_hoehe - hoehe|\).

### Prepress automatic eligibility

`nextTeilStatus()` consults `automatischesPrepressErlaubt()`:

- **STEMPEL — auto-advance allowed:** `TRODAT_PRINTY`, `HOLZSTEMPEL`,
  `STATIVSTEMPEL`, `DATUMSSTEMPEL`, `NACHFUELLFARBE`, `STEMPELKISSEN`,
  `STEMPELPLATTE`.
- **STEMPEL — manual only:** `SONSTIGE_STEMPEL`.

## Notes for Developers

- All UI strings, form fields, status texts, and DB enum values are in
  **German**. Keep the convention when adding code.
- The colour system is centralised in `src/index.css` as CSS variables —
  consume those tokens, do not hardcode colour literals in components.
- The application architecture (three-column shell, per-Bereich modules,
  server-derived aggregate status, file linking instead of upload) is fixed;
  no restructuring is intended.
- For the **current implementation status** and known technical debt, see
  [current_state.md](current_state.md).
