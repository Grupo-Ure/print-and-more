# Systemstatus — Auftragserfassung & Produktionssteuerung

Stand: Codebasis (Vite / React / TypeScript + Supabase). Diese Datei beschreibt den **Ist-Zustand** der Anwendung und relevanter Datenpunkte.

## Tech-Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Backend:** Supabase (PostgreSQL, Auth, RLS — Policies in Supabase, nicht in diesem Repo)
- **Client:** `src/supabase.ts` (`createClient`)

## UI-Layout (`App.tsx`)

Dreispaltig, volle Höhe:

| Spalte | Breite | Inhalt |
|--------|--------|--------|
| Links  | 280px  | `OrderList` — Aufträge, Auswahl |
| Mitte  | 1fr    | `WorkArea` — Auftragskontext + Teilaufträge |
| Rechts | 260px  | Platzhalter „Status & Aktionen“ (noch ohne Funktionsumfang) |

**Gemeinsamer Zustand:** `aktiverAuftragId: string | null` in `App`, an `OrderList` und `WorkArea` durchgereicht.

**Auth:** `Login` mit `supabase.auth.signInWithPassword`; Session-Typ `Session | null`.

## Wichtige Dateien

| Pfad | Rolle |
|------|--------|
| `src/types/database.ts` | Enums, `TeilauftragRow` (inkl. `detail`, `lieferung`), Kunden-Joins |
| `src/types/lfp.ts` | LFP-Teiltypen, `LfpDetailJson`, Anzeigetexte |
| `src/const/teilauftragSelect.ts` | `TEILAUFTRAG_SPALTEN` für `select` nach `update`/`insert` |
| `src/lib/kunde.ts` | `kundenName()`, `kundeErfuelltPrepressKontakt()` (Name + E-Mail oder Telefon) |
| `src/lib/lfp/validateLfpDetail.ts` | LFP-`detail`-Validierung (Pflicht ab `UNVOLLSTAENDIG`, nicht bei `ANGEBOT`) |
| `src/lib/teilGlobal.ts` | Globale Teilfelder, `istTeilAuftragVollstaendig`, `nextTeilStatus` |
| `src/components/OrderList.tsx` | `auftraege` + `kunden(name)`; Auswahl, aktive Zeile hervorgehoben |
| `src/components/WorkArea.tsx` | Auftrag `kunden(name, email, telefon)`; `teilauftraege`; Tabs; Overlay neuer TA |
| `src/components/TeilauftragDetail.tsx` | Globale editierbare Felder + ggf. `LFPDetail`; `speichere` → Supabase; Mitarbeiter-Dropdown |
| `src/components/bereiche/LFPDetail.tsx` | LFP: Typ, Stückzahl, `detail`-JSON, typspezifische Masken, onBlur-Speichern |
| `src/components/AddTeilauftragOverlay.tsx` | Neuer TA: Bereich (DB-Enum vs. Anzeigetext) |
| `src/components/WorkArea.css` | Layout, Formulare, LFP-Styles |
| `src/components/Login.tsx` | Anmeldung |

## Fachmodell (Kurz)

- **Auftrag** — Kunde, globaler Status, 1…n **Teilaufträge**; in der **Mitte** wird `auftraege.status` angezeigt (Aggregation idealerweise in der DB).
- **Teilauftrag** — Spalten u. a. `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, **`detail` (JSONB)** für bereichsspezifische Daten (LFP, später weitere).

### Status

`ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG`

- Neue Teilaufträge: `UNVOLLSTAENDIG`, `prioritaet: NORMAL` (siehe Insert in `WorkArea`).
- **Auto-`PREPRESS_BEREIT`:** in `nextTeilStatus` / Vollständigkeit; Ausnahme LFP `SONSTIGE_LFP`; Kunde muss laut `kundeErfuelltPrepressKontakt` erreichbar sein.
- **Nach `PRODUKTION_BEREIT` / `FERTIG`:** inhaltliche Änderungen führen zurück auf `UNVOLLSTAENDIG` (siehe `teilGlobal`).

### Bereich (Enum `teilauftrag_bereich`)

Nur **Großbuchstaben, kein Leerzeichen** an die DB, z. B. `LFP`, `COPYSHOP`, …

Anzeigenamen über `TEILAUFTRAG_BEREICH_ANZEIGE` / `teilauftragBereichLabel()`.

## Teilauftrag — Spalten & Speicherung (Client)

**Select-Konstante** `TEILAUFTRAG_SPALTEN` (u. a.):

`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, `detail`

- **`lieferung`:** `ABHOLUNG` | `VERSAND` (globales UI-Feld).
- **`verantwortlicher_id`:** UUID; in der UI **Dropdown** aus der View/Relation **`mitarbeiter`** (`select('id, email')`), Anzeige = E-Mail, Wert = `id`. Option „—“ = `null`. UUID ohne Eintrag in der Liste: Zusatzoption mit Hinweis.
- **`detail`:** JSON, **LFP** vollständig in der Validierungslogik in `validateLfpDetail` beschrieben (Stückzahl, Maße OR-Logik, Typ-spezifika, u. a. Fahrzeug: `Altbeklebung` / `montagetermin` nur bei `montage === 'MIT'`, bei `OHNE` Felder entfernt und Werte `null`).

**Insert neuer TA:** u. a. `detail: {}`, `lieferung: null` (siehe `WorkArea`).

## Auftrag-Abfrage (Arbeitsbereich)

`kunden(name, email, telefon)` für Kundenkontext und Auto-Prepress-Regel.

## Bekannte Lücken

- Rechte Spalte nur Platzhalter.
- Weitere Bereiche (CopyShop, Textil, …) ohne eigene `detail`-Masken; nur LFP implementiert.
- `OrderList` wird nicht bei jedem Teilauftrags-Update invalidiert (aggregierter Auftragsstatus in der Liste kann veralten).
