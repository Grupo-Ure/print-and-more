# Systemstand — Auftragserfassung & Produktionssteuerung

Stand: **02.05.2026** · Codebasis unter `/Users/jurgensenwerbung/Desktop/pam app V2/auftragssystem`. Diese Datei beschreibt den **Ist-Zustand** (Tech-Stack, Supabase-Schema laut `src/types/supabase.ts`, Workflows und zentrale Logik). Keine Migrationsdateien im Repo — die Datenbank wird über Supabase gepflegt.

Letzte dokumentierte Commit-Reihe (Auszug vom ältesten zum neuesten): Start → LFP/CC/Stempel/Laser/Sonstige/Textil → Dateiupload → rechte Spalte → Suche/Filter/Historie → Stempel-Umbau → Duplizieren → Bestandspflege Textil/Stempel → diverse Bugfixes → Textilbestand → CSS-Umbau → PDF/ABGERECHNET → ERP-Export UI entfernt, Abrechnen vereinfacht → DateiListe/Duplizieren/konsolidierte Konstanten → ContextPanel/WorkArea-Fixes → `supabase.ts`/Historie/Duplizieren → Produkttabellen + `hat_produkte` → Realtime Kunden → Historie/Auth-Fixes → DateiListe Suchfeld/Ordner → Callbacks `datei_id` → exhaustive-deps → `.gitignore` `.env` → Validierung `VITE_*` → Freigabelogik/Vollständigkeit/Termin/Textil `capPrepress` → UI-Banner/Stempel/DateiListe → Entsperr-Dialog PrePress/Produktion → Datei-Dropdown → Textil 2-Blöcke → Motiv-Frame-Dropdown → **`produkt_dateien`** über alle Bereiche → **Duplizieren kopiert `produkt_dateien`**.

---

## Tech-Stack

- **Runtime / Build:** [Vite](https://vitejs.dev/) 8.x, TypeScript ~6.0, ES-Module.
- **UI:** React 19.x, `react-dom`, `react-router-dom` 7.x (Routen z. B. `/bestandspflege`, `/textil-bestand`).
- **Backend / Daten:** Supabase (`@supabase/supabase-js` 2.x): PostgreSQL, Auth; **RLS und Policies** nur in Supabase, nicht im Repo.
- **Client:** `src/supabase.ts` — `createClient<Database>(url, key)`; beim Start **Pflicht:** Umgebungsvariablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (sonst throw).
- **PDF:** `jspdf`, `jspdf-autotable` (Auftragsexporte).
- **Lint:** ESLint 10.x mit `typescript-eslint`, `eslint-plugin-react-hooks`.

---

## Datenbankstruktur (alle Tabellen, Views, Enums)

Quelle: `src/types/supabase.ts` (generierter Stand, PostgREST 14.5).

### Tabellen (`public.Tables`)

| Tabelle | Kurzbeschreibung |
|---------|------------------|
| `auftraege` | Auftragskopf: `kunde_id`, `auftragsnummer`, `status`, `termin`, `lieferung`, `prioritaet`, `notfall_aktiv`, `archiviert`, `erp_exportiert`, `kaufmaennische_notiz`, `erstellt_am`, `erstellt_von` |
| `auftragsnummer_counter` | Zähler für Auftragsnummern (`jahr`, `monat`, `letzter`) |
| `kunden` | Stammdaten inkl. Adresse, `notiz`, `archiviert` |
| `teilauftraege` | Teilauftrag: `bereich`, `typ`, `status`, `detail` (JSONB), `sortierung`, `datenstatus`, Notfall/Storno, Kundenfreigabe-Felder inkl. `kundenfreigabe_datei_id`, Termin/Lieferung/Priorität, `verantwortlicher_id`, `satzzeit_minuten` |
| `teilauftrag_produkte` | Produkte je Teilauftrag: `teilauftrag_id`, `bereich`, `detail` (JSONB), `sort_order`, `erstellt_am` |
| `produkt_dateien` | Verknüpfung **Produkt → Datei:** `produkt_id`, `datei_id`, `erstellt_am` |
| `dateien` | Auftragsdateien: `auftrag_id`, `anzeigename`, `pfad`, `rolle`, `version`, `ersetzt_datei_id`, `thumbnail_pfad`, `erstellt_von` |
| `historie` | Ereignisprotokoll: `ereignisart`, `teilauftrag_id`, `begruendung`, `meta`, `person_id` |
| `fehler` | Fehlertexte zu Auftrag/Teilauftrag |
| `erp_exporte` | Legacy-Tabelle (Export-Historie); **kein ERP-Export-UI** mehr in der App |
| `lager_bewegungen` | Stempel-Lager (`modell_id` → `stempel_modelle`) |
| `stempel_modelle` | Stempel-Stammdaten inkl. `bestand`, `mindestbestand`, Maße, `typ`, `aktiv` |
| `textil_marken`, `textil_produkte`, `textil_varianten` | Textil-Stammdaten (`farbe_hex`, `bestand`, …) |
| `textil_motive`, `textil_positionen`, `textil_zuordnungen` | Textil-Fachdaten je Teilauftrag |
| `textil_lager_bewegungen` | Textil-Lager je `variante_id` |
| `profile` | Nutzeranzeigenamen (`id`, `name`) |

### Views

| View | Entspricht |
|------|------------|
| `mitarbeiter` | `id`, `email` — Verknüpfung für `verantwortlicher_id`, Historie, etc. |

### Funktionen (RPC)

| Funktion | Rückgabe |
|----------|----------|
| `fn_berechne_auftragsstatus(p_auftrag_id)` | `auftrag_status` — wird vom Client genutzt (`src/lib/auftragsStatus.ts`), um den aggregierten Auftragsstatus zu setzen |

### Enums

- **`auftrag_status`:** `ANGEBOT`, `UNVOLLSTAENDIG`, `PREPRESS_BEREIT`, `PRODUKTION_BEREIT`, `FERTIG`, `ABGERECHNET`
- **`teilauftrag_bereich`:** `LFP`, `COPYSHOP`, `TEXTIL`, `STEMPEL`, `LASERGRAVUR`, `SONSTIGE`
- **`lieferung_typ`:** `ABHOLUNG`, `VERSAND`
- **`prioritaet_typ`:** `NORMAL`, `HOCH`
- **`datei_rolle`:** `PRODUKTIONSDATEI`, `VORSCHAU`, `KUNDENFREIGABE`, `REFERENZ`
- **`historie_ereignis`:** u. a. `AUFTRAG_ERSTELLT`, `IN_BEARBEITUNG_GENOMMEN`, `PREPRESS_BEREIT_AUTO`, `PREPRESS_BEREIT_MANUELL`, `PRODUKTION_BEREIT_GESETZT`, `FERTIG_GEMELDET`, Notfall/Kundenfreigabe-Varianten, `RUECKSPRUNG`, `STORNIERT`, `ERP_EXPORTIERT`
- **`textil_herkunft`:** `KUNDENWARE`, `EIGENWARE`
- **`textil_motiv_typ`:** `TEXT`, `DATEI`
- **`textil_schriftklasse`:** `SERIFENLOS`, `SERIFEN`, `ELEGANT`, `VERSPIELT`

---

## Statusworkflow (Auftrag + Teilauftrag)

### Gemeinsame Status-Enum

Reihenfolge der Phasen (fachlich): `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG` → `ABGERECHNET`.

### Auftrag

- Aggregierter Status über `fn_berechne_auftragsstatus` und Update von `auftraege.status` (`synchronisiereAuftragsstatus`).
- Neuer Auftrag startet typischerweise mit `ANGEBOT` (siehe `NeuerAuftragDialog`).

### Teilauftrag — Ableitung (`nextTeilStatus` in `src/lib/teilGlobal.ts`)

- **`ANGEBOT`:** bleibt `ANGEBOT`, bis der Auftrag in Bearbeitung genommen wird (übergreifend im UI).
- **`capPrepress`:** Ist der **Auftrag** noch `ANGEBOT`, wird ein errechneter Status `PREPRESS_BEREIT` auf **`UNVOLLSTAENDIG`** gedämpft (kein automatisches Prepress, solange der Auftrag im Angebot ist).
- **Globale Pflichtfelder** (ab Status ≠ `ANGEBOT`): `termin`, `lieferung` (`ABHOLUNG`/`VERSAND`), `prioritaet`; optional `verantwortlicher_id` (UUID-Format), `satzzeit_minuten` (ganze Zahl > 0).
- **Nach `PRODUKTION_BEREIT` oder `FERTIG`:** Inhaltliche Änderungen können den Teilauftrag wieder auf `UNVOLLSTAENDIG` setzen:
  - **STEMPEL** und **SONSTIGE:** nur Änderungen an `detail.beschreibung` (und Zeile/Typ/Zeitfelder) gelten als „kritisch“; andere Detailänderungen nicht.
  - **LASERGRAVUR:** analog für `detail.motiv`.
  - **Übrige Bereiche:** jede inhaltliche Abweichung vom letzten Snapshot → `UNVOLLSTAENDIG`.
- **Automatisches `PREPRESS_BEREIT`:** nur wenn Vollständigkeit + Kundenkontakt für Prepress erfüllt und `automatischesPrepressErlaubt()` true (z. B. **nicht** `SONSTIGE_STEMPEL`, nicht Bereich `SONSTIGE`, nicht `SONSTIGE_LASER`, nicht `SONSTIGE_LFP`; Textil siehe eigene Zweige).

### Manuelle / Kontext-Aktionen

- Kontext: `ContextPanel` — u. a. Prepress/Produktion freigeben, fertig melden, Notfall, Kundenfreigabe, Storno, **Abrechnen** (nicht mehr ERP-Export-Dialog).

---

## Bereiche und Produkttypen

Bereiche = Enum `teilauftrag_bereich` / Konstante `TEILAUFTRAG_BEREICHE` in `src/types/database.ts`. Anzeigenamen: `teilauftragBereichLabel()`.

| Bereich | Produkt-/Teiltypen (Auswahl in UI / Typ-Spalte) | Speicherung |
|---------|-----------------------------------------------|-------------|
| **LFP** | `AUFKLEBER`, `SCHILD_UV`, `SCHILD_FOLIE`, `FOLIENPLOTT`, `BANNER`, `ROLLUP`, `FAHRZEUGBESCHRIFTUNG`, `SONSTIGE_LFP` | `teilauftrag_produkte` + `detail` je Produkt; globales `teilauftraege.detail` mit u. a. `hat_produkte` |
| **COPYSHOP** | `PLAKAT_POSTER`, `KARTE_FLYER`, `FALZFLYER`, `BROSCHUERE`, `VISITENKARTE`, `BINDUNG`, `AUSDRUCK` | wie LFP (Produkttabelle) |
| **STEMPEL** | Basis: `TRODAT_PRINTY`, `HOLZSTEMPEL`, `STATIVSTEMPEL`, `DATUMSSTEMPEL`, `SONSTIGE_STEMPEL`; zusätzlich u. a. `NACHFUELLFARBE`, `STEMPELKISSEN`, `STEMPELPLATTE`, `TRODAT_KISSEN` | Produkttabelle + JSONB; Modellauswahl über `stempel_modelle` wo vorgesehen |
| **LASERGRAVUR** | `SCHILD`, `POKALSCHILD`, `NAMENSSCHILD`, `GESCHENKARTIKEL`, `SONSTIGE_LASER` | Produkttabelle |
| **SONSTIGE** | Freitext-/Sammelbereich (keine feste Typ-Liste in `types/`) | Produkttabelle |
| **TEXTIL** | Keine parallele `teilauftrag_produkte`-Produktliste wie oben; Fachdaten in **`textil_motive`**, **`textil_positionen`**, **`textil_zuordnungen`** | Tabellen + JSONB `detail.textil` inkl. Marker `voll` |

Unterkomponenten Copy-Shop: `copyshop/MaterialCC.tsx`, `copyshop/MaterialOffset.tsx` (Materialwahl CC vs. Offset).

---

## Vollständigkeitslogik (`hat_produkte`, Textil)

Implementierung: `istTeilAuftragVollstaendig()` in `src/lib/teilGlobal.ts`.

### Bereiche mit Produkttabelle (LFP, COPYSHOP, STEMPEL, LASERGRAVUR, SONSTIGE)

1. Globale Pflichtfelder müssen ohne Fehler durch `validateGlobalTeilfelder()` laufen.
2. Im JSONB-`detail` des Teilauftrags muss **`detail.hat_produkte === true`** sein. Dieses Flag wird in den Bereichskomponenten gesetzt, wenn **mindestens ein** Eintrag in `teilauftrag_produkte` existiert und nach Löschen aller Produkte wieder entfernt bzw. auf `false` gesetzt.

### Textil

- **`hat_produkte` gilt nicht.** Stattdessen: `textilDetailJsonMarkiertVoll(detail)` in `src/lib/textil/validateTextilDetail.ts` — es muss **`detail.textil.voll === true`** sein (wird gesetzt, wenn Motive, Positionen und Zuordnungen fachlich konsistent sind).
- Für automatisches Prepress zusätzlich: `textilDatensaetzeErlaubenPraepress()` prüft Datenbasis (mind. ein Motiv, eine Position, eine vollständige Zuordnung; Motive TEXT vs. DATEI inkl. `datei_id`; Positionen KUNDENWARE vs. EIGENWARE).

---

## Dateihandling (`DateiListe`, `produkt_dateien`, `datei_id`)

### Auftragsebene — `DateiListe` (`src/components/DateiListe.tsx`)

- Tabelle **`dateien`**, gefiltert über **`auftrag_id`**.
- Felder im UI-Typ `Datei`: `id`, `anzeigename`, `pfad`, `rolle`, `erstellt_am`.
- **`datei_rolle`:** Produktionsdatei, Vorschau, Kundenfreigabe, Referenz.
- Upload-Erfassung als Pfad/Metadaten (kein Binär-Upload durch die Komponente selbst); Nachbearbeitung löst Callback aus für Kontext-Refresh.

### Produktebene — `produkt_dateien`

- **`teilauftrag_produkte`:** eine Zeile = ein Produkt im Teilauftrag (`id` = `produkt_id` in der Verknüpfung).
- **`produkt_dateien`:** verbindet **`produkt_id`** mit **`datei_id`** (referenziert einen Eintrag in **`dateien`**).
- In **LFP, CopyShop, Stempel, Laser, Sonstige** wählt die UI Auftragsdateien aus der `DateiListe`-Liste und legt Zuordnungen in `produkt_dateien` an; Entfernen löscht die Verknüpfung.

### Textil — `datei_id`

- **`textil_motive.datei_id`:** Pflicht für Motive vom Typ **DATEI** (Verweis auf eine Auftragsdatei).

### Kundenfreigabe

- **`teilauftraege.kundenfreigabe_datei_id`** verweist optional auf eine **`dateien.id`** (Freigabedokument).

### Duplizieren

- Beim Duplizieren eines Teilauftrags werden **`teilauftrag_produkte`** kopiert und für nicht-Textil-Bereiche auch **`produkt_dateien`** auf die gleichen Datei-IDs gesetzt (`DuplizierenDialog`).

---

## Komponenten-Übersicht

### `src/components/bereiche/`

| Datei | Rolle |
|-------|--------|
| **`LFPDetail.tsx`** | LFP-Masken nach Teiltyp; **`teilauftrag_produkte`** + **`produkt_dateien`**; Materialkonstanten aus `config/materialien`; Validierung `validateLfpDetail` |
| **`CopyShopDetail.tsx`** | Copy-Shop-Typen; Produktzeilen + Dateizuordnung; nutzt **`MaterialCC`** / **`MaterialOffset`** für Papier/Material |
| **`copyshop/MaterialCC.tsx`** | CC-Materialfelder (Grammatur, Sonderformat) |
| **`copyshop/MaterialOffset.tsx`** | Offset-Material und Sonderoptionen |
| **`StempelDetail.tsx`** | Stempeltypen inkl. Zusatztypen; **`teilauftrag_produkte`**; Bestandsbezug Trodat-Kissen; `validateStempelDetail` |
| **`LaserDetail.tsx`** | Laser-Typen; Produktzeilen + Dateien; `validateLaserDetail` |
| **`SonstigeDetail.tsx`** | Sonstiges; Produktzeilen + Dateien; `validateSonstigeDetail` |
| **`TextilDetail.tsx`** | Zwei Blockbereiche (Motive / Textilien & Zuordnung); direkt **`textil_*`-Tabellen**; Motive TEXT/DATEI; Eigenware über Varianten; Setzen von **`detail.textil.voll`** |

Weitere zentrale Komponenten (außerhalb `bereiche/`): `App.tsx` (Layout, Session), `WorkArea.tsx` (Auftrag, Tabs, `DateiListe`, `TeilauftragDetail`), `TeilauftragDetail.tsx` (Dispatcher je Bereich), `ContextPanel.tsx`, `OrderList.tsx`, `DateiListe.tsx`, `NeuerAuftragDialog.tsx`, `KundeDialog.tsx`, `DuplizierenDialog.tsx`, `Login.tsx`, Seiten `BestandspflegeSeite`, `TextilBestandSeite`.

---

## Offene Punkte / bekannte Lücken

- **Keine SQL-Migrationen im Repository** — Abgleich von Spalten, RLS und RPCs mit Supabase manuell; Typen in `supabase.ts` können gegenüber der Live-DB veralten.
- **`erp_exportiert` / `erp_exporte`:** Feld und Tabelle existieren noch; die **ERP-Export-UI wurde entfernt** — Reste nur noch falls Historie/Altlasten.
- **Aggregierter Auftragsstatus in der linken Liste** aktualisiert sich nicht zwingend live bei jeder mittigen Änderung; Refresh über Auftragswechsel, `orderListKey` oder vergleichbare Trigger.
- **Generierte Typen:** `teilauftrag_produkte` / `produkt_dateien` haben im Typ keine ausgefüllten `Relationships` — echte FKs können in der DB dennoch existieren.
- **`src/types/stempel.ts`** listet nur die Basistypen; **zusätzliche Stempel-Typen** (Nachfüllfarbe, Kissen, Platte, Trodat Kissen) sind in **`StempelDetail.tsx`** / **`teilGlobal`** relevant — ENUM in der DB sollte kompatibel sein.
