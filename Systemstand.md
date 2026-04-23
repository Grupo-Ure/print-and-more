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
| Links  | 280px    | `OrderList` — **„+ Neuer Auftrag“** (öffnet `NeuerAuftragDialog`); Auftragsliste, Auswahl; **keine** archivierten (`.eq('archiviert', false)`) |
| Mitte  | 1fr      | `WorkArea` — Auftragskontext, **Dateien**, Teilaufträge, Detail |
| Rechts | 300px    | `ContextPanel` — Status, Aktionen, Hinweise (Auftrags- und Teilauftrags-Workflow) |

**Gemeinsamer Zustand in `App`:** `aktiverAuftragId`, `aktiverAuftrag` (volles `Auftrag`-Objekt inkl. Kopfdaten, `kunden`-Join, `erp_exportiert`, `archiviert`), `aktiverTeilauftrag`, `auftragKunde`, `auftragDateien`, `kontextAktualisiert` (triggert Refetch in `WorkArea` nach Aktionen im Kontext), `orderListKey` (remount/Refresh der `OrderList` z. B. nach Archivieren, **neu angelegtem Auftrag** oder **gespeichertem Kunde**), `neuerAuftragOffen` (Modal), `kundeDialog` (bearbeiten via `KundeDialog`).

`WorkArea` stößt per Callbacks die Kontext-Synchronisation an: `onAuftragVomArbeitsbereich`, `onAuftragKundeGeladen`, `onAktiverTeilauftragGeaendert`, `onAuftragDateienGeaendert`, `onKundeBearbeiten` (öffnet `KundeDialog` mit Kunde aus `auftragKunde` / Join).

**Dialoge (global in `App`):** `NeuerAuftragDialog` (Auftrag anlegen), `KundeDialog` (Kunde bearbeiten, aus `WorkArea`-Stift oder `ContextPanel` bei Status `ANGEBOT`). Erfolg: `orderListKey` + ggf. `kontextAktualisiert` / `setAktiverAuftragId` (neuer Auftrag).

**Auth:** `Login` mit `supabase.auth.signInWithPassword`; Session-Typ `Session | null`. Ohne Session wird nur das Login-Layout gezeigt.

## `ContextPanel` (`src/components/ContextPanel.tsx`)

- **Sektion Status:** farbige Badges für Auftrags- und (optional) Teilauftragsstatus; **NOTFALL** + Begründung bei `notfall_aktiv`.
- **Sektion Aktionen (Auszug):** Auftrags-Workflow; bei `ANGEBOT` u. a. *In Bearbeitung nehmen* und daneben *Kunde bearbeiten* (`onKundeBearbeiten`); *ERP exportieren* mit Modus, *Archivieren*; Teilauftrags-Workflow (Prepress/Produktion freigeben, fertig melden, Notfall, Kundenfreigabe-Toggle und -erteilung, Storno, Löschen). **Kundenfreigabe** blockiert ausschließlich **Produktion freigeben** (`prodDisabled`); Löschen/Stornieren nutzen **nicht** den globalen `busy`-Sperrstatus (eigene `stornoLaeuft` / `loeschenLaeuft`).
- **Sektion Hinweise:** kontextabhängige Texte (Kundenfreigabe, Notfall, ERP ausstehend, …).
- **Supabase-Aufrufe** inkl. `schreibeHistorie` (`src/lib/historie.ts`) und `synchronisiereAuftragsstatus` via RPC `fn_berechne_auftragsstatus` (`src/lib/auftragsStatus.ts`); `auftraege`-Selects nutzen `AUFTRAG_SPALTEN` (`src/const/auftragSelect.ts`) inkl. `kunden(id, name, email, telefon, notiz)`.

`ContextPanel.css` — Styles für Sektionen, Badges, Modale.

## WorkArea (`src/components/WorkArea.tsx`) — Ablauf von oben nach unten

1. **Auftragskopf:** Kundenname **+ Stift** „Kunde bearbeiten“ (`onKundeBearbeiten`); Auftragsnummer, Auftragsstatus. **Direkt editierbar** (lokal, `onBlur` → Speichern): **Termin** (optional, Datum), **Lieferung** (`ABHOLUNG` / `VERSAND` / leer), **Priorität** (u. a. `NORMAL` / `HOCH`, optional `NIEDRIG` aus der DB sichtbar). Update: `auftraege` mit `termin`, `lieferung`, `prioritaet`.
2. **Dateien (`DateiListe`):** auftragsweite Dateiverknüpfungen; Titel in der UI: **„Dateien“**.
3. Trennlinie.
4. **Teilauftrags-Tabs** (nur **nicht stornierte** Zeilen) + **„+“** (`AddTeilauftragOverlay`).
5. **Aktives Detail** (`TeilauftragDetail` je Bereich).

**Zentraler Datei-State:** `dateien: Datei[]`, `dateienLaden`, `reloadDateien()`; bei Wechsel `aktiverAuftragId` und Anstoß `kontextAktualisiert` (aus `App`).

**Datenladung:** `ladeAuftragUndTeilauftraege(auftragId)`: `auftraege` mit `AUFTRAG_SPALTEN` — u. a. `kunden(id, name, email, telefon, notiz)`, `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert` + `teilauftraege` (volle `TEILAUFTRAG_SPALTEN`); erster sichtbarer (nicht stornierter) Tab bzw. gültige beibehaltene ID.

**Neuer Teilauftrag (Insert):** u. a. `notfall_aktiv: false`, `storniert: false`, Kundenfreigabe-Felder initial “aus”, siehe `WorkArea`.

## Wichtige Dateien (Auswahl)

| Pfad | Rolle |
|------|--------|
| `src/types/database.ts` | `Auftrag` / `AuftragDetailRow` inkl. `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert`; `KundeKontaktRow` inkl. `id`, `notiz`; `TeilauftragRow` inkl. Notfall, Storno, Kundenfreigabe; Enums, `TEILAUFTRAG_BEREICHE` / `teilauftragBereichLabel()` |
| `src/lib/historie.ts` | `schreibeHistorie()`, `HistorieEreignis` |
| `src/lib/auftragsStatus.ts` | `synchronisiereAuftragsstatus(auftragId)` → RPC + Update `auftraege.status` |
| `src/const/teilauftragSelect.ts` | `TEILAUFTRAG_SPALTEN` (siehe unten) |
| `src/const/auftragSelect.ts` | `AUFTRAG_SPALTEN` — `auftraege` + Kunden-Join (einheitlich in `WorkArea`, `ContextPanel`, `auftragsStatus`) |
| `src/lib/kunden.ts` | `Kunde` (Tabelle), `kontaktJoinZuKunde()` |
| `src/components/NeuerAuftragDialog.tsx` | Neuer Auftrag: Kundensuche, `KundeDialog`, Insert `auftraege` (`kunde_id`, Status `ANGEBOT`, optional Termin/Lieferung, Priorität) |
| `src/components/KundeDialog.tsx` | Kunde anlegen/ändern (`kunden` insert/update) |
| `src/types/lfp.ts` | LFP-Teiltypen, `LfpDetailJson` |
| `src/types/copyshop.ts` | Copy-Shop-Teiltypen, `CopyShopDetailJson` |
| `src/types/textil.ts` | Textil-Enums, Zeilen-Typen (Motive, Positionen, Zuordnungen) |
| `src/lib/kunde.ts` | `kundenName()`; `kundeErfuelltPrepressKontakt()` (Kontakt aus `KundeKontaktRow`) |
| `src/lib/teilGlobal.ts` | Globale Pflichtfeld-Validierung, `istTeilAuftragVollstaendig`, `nextTeilStatus` |
| `src/lib/lfp/validateLfpDetail.ts` | LFP-`detail`-Validierung |
| `src/lib/copyshop/validateCopyShopDetail.ts` | Copy-Shop-`detail` |
| `src/lib/stempel/validateStempelDetail.ts` | Stempel-`detail` |
| `src/lib/sonstige/validateSonstigeDetail.ts` | Sonstige-`detail` |
| `src/lib/laser/validateLaserDetail.ts` | Laser-`detail` |
| `src/lib/textil/validateTextilDetail.ts` | Textil: `textil.voll` / Tabellenlogik |
| `src/App.tsx` | Layout, Zustand, `ContextPanel` + `WorkArea` + `OrderList` |
| `src/components/OrderList.tsx` | `auftraege` (Join `kunden(name)`); **„+ Neuer Auftrag“**; Auswahl, aktive Zeile; Filter archiviert |
| `src/components/ContextPanel.tsx` | Rechte Spalte: Status, Aktionen, Historie-Integration |
| `src/components/WorkArea.tsx` | Auftrag, Teilaufträge, Datei-State, `DateiListe`, Tabs, Callbacks fürs Kontext-Panel; **storniert**e aus Tabs ausgeblendet |
| `src/components/DateiListe.tsx` | Dateien-UI; `export type Datei` |
| `src/components/TeilauftragDetail.tsx` | Globale Felder; Bereichsmasken; `auftragDateien` u. a. an Textil |
| `src/components/bereiche/LFPDetail.tsx` | … (wie bisher) |
| `src/components/bereiche/CopyShopDetail.tsx` | … |
| `src/components/bereiche/StempelDetail.tsx` | … |
| `src/components/bereiche/SonstigeDetail.tsx` | … |
| `src/components/bereiche/LaserDetail.tsx` | … |
| `src/components/bereiche/TextilDetail.tsx` | Textil-Tabellen; `detail.textil` + Status |
| `src/components/AddTeilauftragOverlay.tsx` | Neuer TA |
| `src/components/WorkArea.css` | Layout, Formulare |
| `src/components/Login.tsx` | Anmeldung |

## Fachliches Modell (Kurz)

- **Kunde** — Tabelle `kunden` (u. a. `name`, `email`, `telefon`, `notiz`, `archiviert`); Anlage/Bearbeitung über `KundeDialog`; in der Auftragssuche (`NeuerAuftragDialog`) Freitextsuche per `ilike` auf `name` (nur `archiviert = false`). Join auf Auftragszeilen: `KundeKontaktRow` inkl. `id` / `notiz` für Anzeige und Formulare.
- **Auftrag** — `kunde_id` → Kunde, `status` (u. a. per `fn_berechne_auftragsstatus` abgeglichen), **Kopf:** optional `termin`, `lieferung` (`ABHOLUNG` \| `VERSAND`), `prioritaet` (z. B. `NORMAL` \| `HOCH`), `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert`, 1…n **Teilaufträge**; **neue Aufträge** aus `NeuerAuftragDialog` mit Status `ANGEBOT`. In der Mitte/Context wird `auftraege` inkl. Join gelesen/aktualisiert.
- **Dateien** — gehören zum **Auftrag** (`dateien.auftrag_id`); in der App zentral in der `WorkArea` geladen; für Kundenfreigabe im `ContextPanel` wählbar.
- **Teilauftrag** — u. a. bisherige Spalten plus **`notfall_aktiv`**, **`notfall_begruendung`**, **`storniert`**, Kundenfreigabe-Felder; **`detail` (JSONB)** für LFP, Copy-Shop, etc.; **TEXTIL** wie zuvor mit Tabellen.

### Status (Auftrag & Teilauftrag)

Reihenfolge: `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG`

- **Neue Teilaufträge (Insert):** s. `WorkArea` (inkl. Defaults für Notfall/Storno/Kundenfreigabe).
- **Bereichs- und `nextTeilStatus`-Logik** unverändert inhaltlich: siehe `teilGlobal` / Validatoren (Detailbeschreibung wie in früheren Ständen).
- **Kontext-Panel** kann Status manuell setzen, Notfall, ERP-Insert, Archiv, Historieneinträge.

### Teilauftrag-Bereich (Enum `teilauftrag_bereich`)

Unverändert: dieselben DB-Enum-Strings, `teilauftragBereichLabel()`.

## Teilauftrag — Spalten & Speicherung (Client)

**`TEILAUFTRAG_SPALTEN`:**  
`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `lieferung`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`, `detail`, `notfall_aktiv`, `notfall_begruendung`, `storniert`, `kundenfreigabe_erforderlich`, `kundenfreigabe_liegt_vor`, `kundenfreigabe_datei_id`

- Weitere fachliche Felder (`lieferung`, `verantwortlicher_id`, `detail`, …) wie bisher in der Doku.
- **Auftrag in der Arbeitsfläche / Kontext:** vgl. `AUFTRAG_SPALTEN` — u. a. `kunden(id, name, email, telefon, notiz)`, `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `erstellt_am`, `erp_exportiert`, `archiviert` (siehe `src/const/auftragSelect.ts`).

## Supabase-Tabellen & Funktionen (vom Client genutzt, Auszug)

- **`kunden`:** `insert` / `update` / Suche (Name) aus `NeuerAuftragDialog` / `KundeDialog`.
- **`auftraege`:** inkl. `kunde_id`, `status`, `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, u. a., `erp_exportiert`, `archiviert`, Join `kunden(…)`.
- **`teilauftraege`:** voll gemäß `TEILAUFTRAG_SPALTEN`.
- **`dateien`:** u. a. `id`, `auftrag_id`, `anzeigename`, `rolle` …
- **`historie`:** Ereignisse inkl. `ereignisart`, `person_id` (Auth-User), optional `teilauftrag_id`, `begruendung`, `meta`.
- **`erp_exporte`:** u. a. `auftrag_id`, `modus` (`EINZELN` \| `GESAMMELT`), `exportdaten` (JSON).
- **`textil_motive`**, **`textil_positionen`**, **`textil_zuordnungen`:** Textil-Detail.
- **`mitarbeiter`:** `id`, `email` (Verantwortlicher).
- **RPC** `fn_berechne_auftragsstatus(p_auftrag_id)` — Ergebnis wird als Soll-`status` in `auftraege` geschrieben (Client: `synchronisiereAuftragsstatus`).

## Bekannte Lücken / offene Punkte

- **RLS/Schema in Supabase** müssen die genannten Spalten, Tabellen und die RPC abdecken; das Repo enthält **keine** Migrations-Dateien. Für Auftragskopf, `kunde_id` und erweiterten Kunden-Join muss die DB zu den in `AUFTRAG_SPALTEN` / Dialogen genutzten Spalten passen.
- Aggregierter `auftraege.status` in der **linken Liste** aktualisiert sich nicht live bei rein mittiger Bearbeitung; Wechsel der Auswahl, Refetch (z. B. `orderListKey` nach Archiv, **neuem Auftrag** oder **Kundenänderung**) aktualisieren.
