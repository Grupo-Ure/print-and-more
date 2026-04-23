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
| Mitte  | 1fr      | `WorkArea` — Auftragskontext, **Dateien**, Teilaufträge, Detail |
| Rechts | 260px    | Platzhalter „Status & Aktionen“ (noch ohne fachlichen Funktionsumfang) |

**Gemeinsamer Zustand:** `aktiverAuftragId: string | null` in `App`, an `OrderList` und `WorkArea` durchgereicht.

**Auth:** `Login` mit `supabase.auth.signInWithPassword`; Session-Typ `Session | null`. Ohne Session wird nur das Login-Layout gezeigt.

## WorkArea (`src/components/WorkArea.tsx`) — Ablauf von oben nach unten

1. **Auftragskopf:** Kundenname, Auftragsnummer, Auftragsstatus (aus `auftraege`).
2. **Dateien (`DateiListe`):** auftragsweite Dateiverknüpfungen; Titel in der UI: **„Dateien“** (keine künstliche Nähe zu einem einzelnen Teilauftrag).
3. Trennlinie.
4. **Teilauftrags-Tabs** + **„+“** (neuer Teilauftrag, Overlay `AddTeilauftragOverlay`).
5. **Aktives Detail** (`TeilauftragDetail` je Bereich).

**Zentraler Datei-State:** `dateien: Datei[]`, `dateienLaden`, `reloadDateien()`; Ladetrigger bei Wechsel von `aktiverAuftragId`. `DateiListe` und `TeilauftragDetail` (für z. B. **TEXTIL** → Datei-Motiv-Dropdown) nutzen dieselbe Liste aus der WorkArea — keine doppelte Datei-Abfrage in den Kindkomponenten.

**Datenladung:** `ladeAuftragUndTeilauftraege(auftragId)`: `auftraege` (mit `kunden(name, email, telefon)`) + `teilauftraege` (via `TEILAUFTRAG_SPALTEN`); aktiver Tab folgt der ersten Rückgabe bzw. bleibt erhalten, wenn die ID noch existiert.

## Wichtige Dateien (Auswahl)

| Pfad | Rolle |
|------|--------|
| `src/types/database.ts` | Enums, `TeilauftragRow` inkl. `detail`, `lieferung`, Kunden-Joins; `TEILAUFTRAG_BEREICHE` / `teilauftragBereichLabel()` |
| `src/types/lfp.ts` | LFP-Teiltypen, `LfpDetailJson` |
| `src/types/copyshop.ts` | Copy-Shop-Teiltypen, `CopyShopDetailJson` |
| `src/types/textil.ts` | Textil-Enums, Zeilen-Typen (Motive, Positionen, Zuordnungen) |
| `src/const/teilauftragSelect.ts` | `TEILAUFTRAG_SPALTEN` für `select` nach `update` / `insert` |
| `src/lib/kunde.ts` | `kundenName()`; `kundeErfuelltPrepressKontakt()` (Name + E-Mail **oder** Telefon) |
| `src/lib/teilGlobal.ts` | Globale Pflichtfeld-Validierung, `istTeilAuftragVollstaendig`, `nextTeilStatus` inkl. **LFP, COPYSHOP, STempel, Sonstige, Laser, Sonderfälle, TEXTIL** |
| `src/lib/lfp/validateLfpDetail.ts` | LFP-`detail`-Validierung (außer bei `ANGEBOT`) |
| `src/lib/copyshop/validateCopyShopDetail.ts` | Copy-Shop-`detail` je `typ` |
| `src/lib/stempel/validateStempelDetail.ts` | Stempel-`detail` |
| `src/lib/sonstige/validateSonstigeDetail.ts` | Sonstige-`detail` |
| `src/lib/laser/validateLaserDetail.ts` | Laser-`detail` |
| `src/lib/textil/validateTextilDetail.ts` | Textil: `textilDetailJsonMarkiertVoll` (`detail.textil.voll`); `textilDatensaetzeErlaubenPraepress` (Tabellenlogik) |
| `src/components/OrderList.tsx` | `auftraege` + `kunden(name)`; Auswahl, aktive Zeile |
| `src/components/WorkArea.tsx` | Auftrag, Teilaufträge, **Datei-State**, `DateiListe`, Tabs, Overlay |
| `src/components/DateiListe.tsx` | Dateien-UI; `export type Datei`, `useDateienFuerAuftrag(auftragId)` für externe Nutzung; Props `dateien` + `onDateiGeaendert` wenn eingebunden |
| `src/components/TeilauftragDetail.tsx` | Globale Felder; wechselnde Bereichsmaske: LFP, CopyShop, Stempel, Sonstige, Laser, **Textil**; `auftragDateien` an Textil |
| `src/components/bereiche/LFPDetail.tsx` | LFP: Typ, Stückzahl, `detail` |
| `src/components/bereiche/CopyShopDetail.tsx` | Copy-Shop: `typ` + `detail` |
| `src/components/bereiche/StempelDetail.tsx` | Stempel: `typ` + `detail` |
| `src/components/bereiche/SonstigeDetail.tsx` | Sonstige: `detail` |
| `src/components/bereiche/LaserDetail.tsx` | Laser: `typ` + `detail` |
| `src/components/bereiche/TextilDetail.tsx` | Textil: Motive, Positionen, Zuordnungen (eigene Tabellen); `auftragDateien` für Datei-Motive; Synchronisation `detail.textil` + Status |
| `src/components/AddTeilauftragOverlay.tsx` | Neuer TA: Bereich (DB-Enum vs. Anzeigetext) |
| `src/components/WorkArea.css` | Layout, Formulare, Bereichs-Styles |
| `src/components/Login.tsx` | Anmeldung |

## Fachliches Modell (Kurz)

- **Auftrag** — Kunde, globaler `status`, 1…n **Teilaufträge**; in der Mitte wird `auftraege.status` aus der DB gelesen (sinnvolle Aggregation idealerweise per Trigger/View in Supabase).
- **Dateien** — gehören zum **Auftrag** (`dateien.auftrag_id`); in der App zentral in der WorkArea geladen, für alle Bereiche nutzbar.
- **Teilauftrag** — u. a. `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, **`detail` (JSONB)** für LFP, Copy-Shop, Stempel, Sonstige, Laser; **TEXTIL** nutzt zusätzlich Tabellen `textil_motive`, `textil_positionen`, `textil_zuordnungen` und spiegelt Vollständigkeit in `detail.textil.voll`.

### Status (Auftrag & Teilauftrag)

Reihenfolge: `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG`

- **Neue Teilaufträge (Insert):** `UNVOLLSTAENDIG`, `prioritaet: 'NORMAL'`, u. a. `detail: {}`, `lieferung: null` (siehe `WorkArea`).
- **ANGEBOT:** globale und bereichsspezifische **Pflichtvalidierung** entfällt (siehe `validateGlobalTeilfelder` / Bereich-Validatoren mit `teilStatus === 'ANGEBOT'` bzw. `istTeilAuftragVollstaendig`).
- **Auto-`PREPRESS_BEREIT`:** in `nextTeilStatus` für u. a. **LFP**, **COPYSHOP**, **TEXTIL** bei Vollständigkeit und erfülltem Kundenkontakt; **Ausnahmen** u. a. LFP `SONSTIGE_LFP`, Stempel `SONSTIGE_STEMPEL`, Laser `SONSTIGE_LASER` (vgl. `teilGlobal.ts` — anderes Rückfallverhalten), **SONSTIGE** mit eigener `PREPRESS_BEREIT`-Logik.
- **Nach `PRODUKTION_BEREIT` / `FERTIG`:** inhaltliche Änderungen führen je nach Bereich zurück auf `UNVOLLSTAENDIG` (Stempel/Sonstige: `beschreibung`; Laser: `detail.motiv`; sonst `teilHatInhaltAenderung`); **TEXTIL** zusätzlich spezifische Rücksprungregeln bei Motiv/Position/Zuordnung.
- **TEXTIL:** Vollständigkeit = globale Felder + `detail.textil.voll === true` (wird aus den Textil-Tabellen berechnet und beim Speichern mitgeschrieben).

### Teilauftrag-Bereich (Enum `teilauftrag_bereich`)

Nur **dieselben Enum-Strings** (Großbuchstaben, kein Leerzeichen) gehen an die API/DB, z. B. `LFP`, `COPYSHOP`, `TEXTIL`, `STEMPEL`, `LASERGRAVUR`, `SONSTIGE`.

**Anzeige** über `TEILAUFTRAG_BEREICH_ANZEIGE` / `teilauftragBereichLabel()` (z. B. `COPYSHOP` → `CopyShop`).

| Enum        | UI-Label (Kurz) |
|------------|-----------------|
| LFP        | LFP             |
| COPYSHOP   | CopyShop        |
| TEXTIL     | Textil          |
| …          | …               |

**TEXTIL:** kein `typ` in der UI (bleibt `null` im Erfassungsflow der Maske). Motive/Positionen/Zuordnungen über die genannten Tabellen.

## Teilauftrag — Spalten & Speicherung (Client)

**`TEILAUFTRAG_SPALTEN`:**  
`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, `detail`

- **`lieferung`:** `ABHOLUNG` | `VERSAND` (globales Formularfeld).
- **`verantwortlicher_id`:** UUID; **Dropdown** aus der View/Relation `mitarbeiter` (`select('id, email')`), Anzeige = E‑Mail, Wert = `id`. Option „—“ = `null`. Gesetzte UUID ohne Treffer: Zusatzoption mit Hinweis.
- **`satzzeit_minuten`:** optional; valide Werte: ganze Zahl &gt; 0, sonst Fehler.
- **`detail` (JSONB):** pro Bereich; **TEXTIL** ergänzt `textil: { voll: boolean }` für die Statuslogik.
- **Copy-Shop:** u. a. `COPY_SHOP_TYPS` (u. a. `PLAKAT_POSTER`, `KARTE_FLYER`, `FALZFLYER`, `BROSCHUERE`, `VISITENKARTE`, `BINDUNG`, `AUSDRUCK`); **Bindung:** u. a. `farbigkeit`.

**Auftrag in der Arbeitsfläche:** `kunden(name, email, telefon)` für Kontext und Prepress-Regel.

## Supabase-Tabellen (vom Client genutzt, Auszug)

- **`auftraege`:** u. a. `id`, `auftragsnummer`, `status`, `erstellt_am`, Join `kunden(…)`.
- **`teilauftraege`:** Spalten wie oben; Inserts/Updates mit den genannten Feldern.
- **`dateien`:** u. a. `id`, `auftrag_id`, `anzeigename`, `pfad`, `rolle`, `erstellt_am` (Auftrags-Datei-Management).
- **`textil_motive`**, **`textil_positionen`**, **`textil_zuordnungen`:** Textil-Detail (siehe `TextilDetail.tsx`).
- **`mitarbeiter`:** `id`, `email` (für Verantwortlichen-Auswahl).

## Bekannte Lücken / geplante Erweiterungen

- Rechte Spalte: **nur Platzhalter** „Status & Aktionen“; kein `ContextPanel`, keine Historie-API im Repo, keine Kundenfreigabe-/Notfall-Felder im `TeilauftragRow` des Clients (Stand dieser Doku) — ggf. DB-Erweiterung und UI folgen.
- `OrderList` wird nicht bei jeder Teilauftrags-Änderung invalidiert; der aggregierte `auftraege.status` in der Liste kann gegenüber dem geöffneten Auftrag veralten, bis man neu lädt oder die Auswahl wechselt.
