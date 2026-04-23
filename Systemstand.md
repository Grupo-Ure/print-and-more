# Systemstand — Auftragserfassung & Produktionssteuerung

Stand: **23.04.2026** · interne Codebasis (Vite 8 / React 19 / TypeScript + Supabase). Diese Datei beschreibt den **Ist-Zustand** der App, der relevanten Dateien und des fachlichen Modells. *(Zusammenführung der früheren `SYSTEM_STATE.md` und `SYSTEM_STATUS.md`.)*

## Tech-Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Backend:** Supabase (PostgreSQL, Auth, RLS — Policies in Supabase, nicht in diesem Repo)
- **Client:** `src/supabase.ts` (`createClient`)

## UI-Layout (`App.tsx`)

Dreispaltig, volle Höhe:

| Spalte | Breite   | Inhalt |
|--------|----------|--------|
| Links  | 280px    | `OrderList` — Aufträge, Auswahl |
| Mitte  | 1fr      | `WorkArea` — Auftragskontext + Teilaufträge |
| Rechts | 260px    | Platzhalter „Status & Aktionen“ (noch ohne Funktionsumfang) |

**Gemeinsamer Zustand:** `aktiverAuftragId: string | null` in `App`, an `OrderList` und `WorkArea` durchgereicht.

**Auth:** `Login` mit `supabase.auth.signInWithPassword`; Session-Typ `Session | null`. Ohne Session wird nur das Login-Layout gezeigt.

## Wichtige Dateien (Auswahl)

| Pfad | Rolle |
|------|--------|
| `src/types/database.ts` | Enums, `TeilauftragRow` inkl. `detail`, `lieferung`, Kunden-Joins; `TEILAUFTRAG_BEREICHE` / `teilauftragBereichLabel()` |
| `src/types/lfp.ts` | LFP-Teiltypen, `LfpDetailJson` |
| `src/types/copyshop.ts` | Copy-Shop-Teiltypen, `CopyShopDetailJson` |
| `src/const/teilauftragSelect.ts` | `TEILAUFTRAG_SPALTEN` für `select` nach `update` / `insert` |
| `src/lib/kunde.ts` | `kundenName()`; `kundeErfuelltPrepressKontakt()` (Name + E-Mail **oder** Telefon) |
| `src/lib/teilGlobal.ts` | Globale Pflichtfeld-Validierung, `istTeilAuftragVollstaendig`, `nextTeilStatus` (LFP, Copy-Shop, Sonderfall `SONSTIGE_LFP`) |
| `src/lib/lfp/validateLfpDetail.ts` | LFP-`detail`-Validierung (außer bei `ANGEBOT`) |
| `src/lib/copyshop/validateCopyShopDetail.ts` | Copy-Shop-`detail` je `typ` (u. a. Plakat, Karte, Falz, Broschüre, Visitenkarte, **Bindung**, Ausdruck) |
| `src/components/OrderList.tsx` | `auftraege` + `kunden(name)`; Auswahl, aktive Zeile |
| `src/components/WorkArea.tsx` | Auftrag mit `kunden(name, email, telefon)`; `teilauftraege`; Tabs; Overlay neuer Teilauftrag; Insert/Update |
| `src/components/TeilauftragDetail.tsx` | Globale editierbare Felder; bei `LFP` → `LFPDetail`, bei `COPYSHOP` → `CopyShopDetail`; Speichern in Supabase; Mitarbeiter-Dropdown |
| `src/components/bereiche/LFPDetail.tsx` | LFP: Typ, Stückzahl, `detail`, typspezifische Masken |
| `src/components/bereiche/CopyShopDetail.tsx` | Copy-Shop: `typ` + `detail` (Hilfe-Komponenten u. a. `MaterialCC`, `MaterialOffset`) |
| `src/components/AddTeilauftragOverlay.tsx` | Neuer TA: Bereich (DB-Enum vs. Anzeigetext) |
| `src/components/WorkArea.css` | Layout, Formulare, Bereichs-Styles |
| `src/components/Login.tsx` | Anmeldung |

## Fachliches Modell (Kurz)

- **Auftrag** — Kunde, globaler `status`, 1…n **Teilaufträge**; in der Mitte wird `auftraege.status` aus der DB gelesen (sinnvolle Aggregation idealerweise per Trigger/View in Supabase).
- **Teilauftrag** — u. a. `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, **`detail` (JSONB)** für LFP, Copy-Shop und künftige Bereiche.

### Status (Auftrag & Teilauftrag)

Reihenfolge: `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG`

- **Neue Teilaufträge (Insert):** `UNVOLLSTAENDIG`, `prioritaet: 'NORMAL'`, u. a. `detail: {}`, `lieferung: null` (siehe `WorkArea`).
- **ANGEBOT:** globale und bereichsspezifische **Pflichtvalidierung** entfällt (siehe `validateGlobalTeilfelder` / `validateLfpDetail` / `validateCopyShopDetail` mit `teilStatus === 'ANGEBOT'` bzw. `istTeilAuftragVollstaendig`).
- **Auto-`PREPRESS_BEREIT`:** in `nextTeilStatus` nur für **LFP** und **COPYSHOP** bei Vollständigkeit und erfülltem Kundenkontakt; **Ausnahme** LFP mit `typ === 'SONSTIGE_LFP'` (kein automatischer Schritt in `PREPRESS_BEREIT` wie bei den übrigen LFP-Typen, analog `SONSTIGE_LFP` in der alten Doku). 
- **Nach `PRODUKTION_BEREIT` / `FERTIG`:** inhaltliche Änderungen führen zurück auf `UNVOLLSTAENDIG` (`teilHatInhaltAenderung` in `teilGlobal.ts`).
- **Bereiche ohne LFP/Copy-Shop:** `nextTeilStatus` führt faktisch vorerst zu `UNVOLLSTAENDIG` (Vollständigkeitslogik noch nicht an andere Bereiche angebunden).

### Teilauftrag-Bereich (Enum `teilauftrag_bereich`)

Nur **dieselben Enum-Strings** (Großbuchstaben, kein Leerzeichen) gehen an die API/DB, z. B. `LFP`, `COPYSHOP`, `TEXTIL`, `STEMPEL`, `LASERGRAVUR`, `SONSTIGE`.

**Anzeige** über `TEILAUFTRAG_BEREICH_ANZEIGE` / `teilauftragBereichLabel()` (z. B. `COPYSHOP` → `CopyShop`).

| Enum        | UI-Label (Kurz) |
|------------|-----------------|
| LFP        | LFP             |
| COPYSHOP   | CopyShop        |
| TEXTIL     | Textil          |
| …          | …               |

## Teilauftrag — Spalten & Speicherung (Client)

**`TEILAUFTRAG_SPALTEN`:**  
`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, `detail`

- **`lieferung`:** `ABHOLUNG` | `VERSAND` (globales Formularfeld).
- **`verantwortlicher_id`:** UUID; **Dropdown** aus der View/Relation `mitarbeiter` (`select('id, email')`), Anzeige = E‑Mail, Wert = `id`. Option „—“ = `null`. Gesetzte UUID ohne Treffer: Zusatzoption mit Hinweis.
- **`satzzeit_minuten`:** optional; valide Werte: ganze Zahl &gt; 0, sonst Fehler; Anzeige z. B. „n Min“.
- **`detail` (JSONB):**  
  - **LFP:** Logik in `validateLfpDetail` (u. a. Stückzahl, Maße, typabhängig; Fahrzeug: Montagefelder nur bei `montage === 'MIT'`, bei `OHNE` bereinigt).  
  - **COPYSHOP:** Teiltypen in `COPY_SHOP_TYPS` (u. a. `PLAKAT_POSTER`, `KARTE_FLYER`, `FALZFLYER`, `BROSCHUERE`, `VISITENKARTE`, `BINDUNG`, `AUSDRUCK`); Logik in `validateCopyShopDetail` und UI in `CopyShopDetail`. **Bindung:** u. a. `farbigkeit` (Werte wie `1_0`, `1_1`, `4_0`, `4_1`); **kein** `druckseite`-Feld/Validierung im Typ Bindung (im Gegensatz z. B. zu Visitenkarte).  

**Auftrag in der Arbeitsfläche:** `kunden(name, email, telefon)` für Kontext und Prepress-Regel.

## Supabase-Tabellen (vom Client genutzt, Auszug)

- **`auftraege`:** u. a. `id`, `auftragsnummer`, `status`, `erstellt_am`, Join `kunden(…)`.
- **`teilauftraege`:** Spalten wie oben; Inserts/Updates mit den genannten Feldern.
- **`mitarbeiter`:** `id`, `email` (für Verantwortlichen-Auswahl).

## Bekannte Lücken / geplante Erweiterungen

- Rechte Spalte: nur Platzhalter, keine fachlichen Aktionen.
- **Bereiche** außer **LFP** und **COPYSHOP:** keine eigenen `detail`-Masken; `detail` bleibt leer bzw. ungenutzt.
- `OrderList` wird nicht bei jeder Teilauftrags-Änderung invalidiert; der aggregierte `auftraege.status` in der Liste kann gegenüber dem geöffneten Auftrag veralten, bis man neu lädt oder die Auswahl wechselt.
