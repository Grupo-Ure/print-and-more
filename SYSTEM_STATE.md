# Systemstand — Auftragserfassung & Produktionssteuerung

Stand: interne Codebasis (Vite/React/TypeScript + Supabase). Diese Datei beschreibt den **Ist-Zustand** der App und relevanter Datenmodelle.

## Tech-Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Backend:** Supabase (PostgreSQL, Auth, RLS — RLS-Policies werden in Supabase gepflegt, nicht in diesem Repo)
- **Client:** `src/supabase.ts` (`createClient`)

## UI-Layout (`App.tsx`)

Dreispaltig, volle Höhe:

| Spalte | Breite   | Inhalt |
|--------|----------|--------|
| Links  | 280px    | `OrderList` — Aufträge, Auswahl |
| Mitte  | 1fr      | `WorkArea` — Auftragskontext + Teilaufträge |
| Rechts | 260px    | Platzhalter „Status & Aktionen“ (noch kein Funktionsumfang) |

**Gemeinsamer UI-Zustand:** `aktiverAuftragId: string | null` in `App`, an `OrderList` und `WorkArea` durchgereicht.

**Auth:** Kein Layout ohne Session: `Login` mit `supabase.auth.signInWithPassword`. Session-Typ: `Session | null` (Supabase).

## Module & Dateien (relevant)

| Pfad | Rolle |
|------|--------|
| `src/types/database.ts` | Status-, Bereichs- und Row-Typen; `TEILAUFTRAG_BEREICHE`, `TEILAUFTRAG_BEREICH_ANZEIGE`, `teilauftragBereichLabel()` |
| `src/lib/kunde.ts` | `kundenName()` — normalisiert PostgREST-Join `kunden` (Objekt oder 1-Element-Array) |
| `src/components/OrderList.tsx` | Liste `auftraege` mit `kunden(name)`; Klick setzt `aktiverAuftragId`; aktiver Eintrag optisch hervorgehoben |
| `src/components/WorkArea.tsx` | Lädt Auftrag + `teilauftraege`; Kopfzeile, Tabs, „+“ neuer Teilauftrag, Fehler/Ladezustand |
| `src/components/WorkArea.css` | Styles Arbeitsbereich, Tabs, Overlay, Detail |
| `src/components/AddTeilauftragOverlay.tsx` | Modal: Bereich wählen (Anzeige = Label, Wert = Enum) |
| `src/components/TeilauftragDetail.tsx` | Read-only Felder des gewählten Teilauftrags |
| `src/components/Login.tsx` | Login-Formular |

## Fachliches Modell (logisch)

- **Auftrag** — Kunde, globaler Status, 1…n Teilaufträge.
- **Teilauftrag** — operativ: Bereich (`teilauftrag_bereich`), Typ, Status, Termin, Priorität, `verantwortlicher_id`, `satzzeit_minuten`.
- **Auftragsstatus** — im System als Aggregat aus Teilaufträgen gedacht; **Anzeige** liest den in `auftraege.status` gespeicherten Wert (Aggregation in der DB/Trigger, falls vorhanden).

### Status (Auftrag & Teilauftrag)

Reihenfolge: `ANGEBOT` → `UNVOLLSTAENDIG` → `PREPRESS_BEREIT` → `PRODUKTION_BEREIT` → `FERTIG`

- Teilaufträge starten in der UI/DB-Einfügung mit `UNVOLLSTAENDIG`; `ANGEBOT` ist für Teilaufträge nicht vorgesehen.

### Teilauftrag-Bereich (Supabase-Enum `teilauftrag_bereich`)

**Nur diese enum-Werte** (Großbuchstaben, keine Leerzeichen) gehen an die API/DB:

`LFP` | `COPYSHOP` | `TEXTIL` | `STEMPEL` | `LASERGRAVUR` | `SONSTIGE`

**Anzeige im UI** (≠ DB-Wert), zentral in `TEILAUFTRAG_BEREICH_ANZEIGE` / `teilauftragBereichLabel()`:

| Enum        | UI-Label   |
|-------------|------------|
| LFP         | LFP        |
| COPYSHOP    | CopyShop   |
| TEXTIL      | Textil     |
| STEMPEL     | Stempel    |
| LASERGRAVUR | Lasergravur |
| SONSTIGE    | Sonstige   |

## Supabase-Tabellen (vom Client genutzt)

### `auftraege`

- Liste: `id`, `auftragsnummer`, `status`, `erstellt_am`, Join `kunden(name)`.
- Detail (WorkArea): `id`, `auftragsnummer`, `status`, `kunden(name)`.

### `teilauftraege`

Abfrage-Spalten im Client (siehe Konstante in `WorkArea.tsx`):

`id`, `auftrag_id`, `bereich`, `typ`, `status`, `termin`, `prioritaet`, `verantwortlicher_id`, `satzzeit_minuten`

- **`verantwortlicher_id`:** UUID, Referenz auf `auth.users` (Anzeige aktuell: UUID-String).
- **`satzzeit_minuten`:** Integer, Anzeige als „n Min“, leer/ungültig ≤ 0 als „—“.

**Neuer Teilauftrag (Insert):** `auftrag_id`, `bereich` (Enum-String), `status: 'UNVOLLSTAENDIG'`, `prioritaet: 'NORMAL'`.

## Bekannte Lücken / nächste Schritte (nicht als erledigt dokumentiert)

- Rechte Spalte: nur Platzhaltertext.
- Verantwortlicher: keine Auflösung zu Anzeigenamen/E-Mail (nur UUID).
- OrderList wird bei neuen Teilaufträgen nicht automatisch neu geladen (Auftragsstatus in der Liste kann veralten, bis Refresh/Neuladen).
- Kein Bearbeiten von Teilauftragsfeldern im UI (nur Anzeige + neuer Teilauftrag).
