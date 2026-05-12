# Database Schema Rename Map

Definitive mapping from the original German identifiers to the final English names
applied in `supabase/migrations/20260508081503_remote_schema.sql`.

Use this when updating service layer `.from()`, `.rpc()`, `.select()`, `.eq()`,
`.filter()`, `.insert()`, `.update()`, and `.order()` calls. The "Old" column is
always the original German; the "New" column is the final name in the migration.

---

## Tables

| Old (German) | New (English) | Kind |
|---|---|---|
| `auftraege` | `orders` | table |
| `auftragsnummer_counter` | `order_number_counter` | table |
| `dateien` | `files` | table |
| `erp_exporte` | `erp_exports` | table |
| `fehler` | `errors` | table |
| `historie` | `history` | table |
| `kunden` | `customers` | table |
| `lager_bewegungen` | `stamp_stock_movements` | table |
| `mitarbeiter` | `employees` | view |
| `produkt_dateien` | `product_files` | table |
| `profile` | `profiles` | table |
| `stempel_modelle` | `stamp_models` | table |
| `teilauftraege` | `sub_orders` | table |
| `teilauftrag_produkte` | `sub_order_products` | table |
| `textil_bewegungen` | `textile_stock_movements` | table |
| `textil_marken` | `textile_brands` | table |
| `textil_motive` | `textile_motifs` | table |
| `textil_positionen` | `textile_positions` | table |
| `textil_produkte` | `textile_products` | table |
| `textil_varianten` | `textile_variants` | table |
| `textil_zuordnungen` | `textile_assignments` | table |
| `blueprint_customers` | `blueprint_customers` | table (unchanged — already English) |
| `blueprint_jobs` | `blueprint_jobs` | table (unchanged — already English) |
| `blueprint_job_items` | `blueprint_job_items` | table (unchanged — already English) |
| `blueprint_projects` | `blueprint_projects` | table (unchanged — already English) |

### Note on `textil_bewegungen`

The service layer `textileMasterDataService.ts` referenced this as
`textil_lager_bewegungen`. The canonical new name is `textile_stock_movements`.

---

## Columns

### `orders`

| Old | New | Notes |
|---|---|---|
| `auftragsnummer` | `order_number` | |
| `kunde_id` | `customer_id` | |
| `termin` | `deadline` | |
| `lieferung` | `delivery` | |
| `prioritaet` | `priority` | |
| `notfall_aktiv` | `is_emergency` | boolean → `is_` prefix |
| `archiviert` | `is_archived` | boolean → `is_` prefix |
| `erp_exportiert` | `is_erp_exported` | boolean → `is_` prefix |
| `kaufmaennische_notiz` | `billing_note` | |
| `erstellt_am` | `created_at` | |
| `erstellt_von` | `created_by` | |

### `order_number_counter`

| Old | New |
|---|---|
| `jahr` | `year` |
| `monat` | `month` |
| `letzter` | `last_value` |

### `files`

| Old | New |
|---|---|
| `auftrag_id` | `order_id` |
| `anzeigename` | `display_name` |
| `pfad` | `path` |
| `rolle` | `role` |
| `thumbnail_pfad` | `thumbnail_path` |
| `ersetzt_datei_id` | `replaces_file_id` |
| `erstellt_am` | `created_at` |
| `erstellt_von` | `created_by` |

### `erp_exports`

| Old | New |
|---|---|
| `auftrag_id` | `order_id` |
| `modus` | `mode` |
| `exportiert_am` | `exported_at` |
| `exportiert_von` | `exported_by` |
| `exportdaten` | `export_data` |

### `errors`

| Old | New |
|---|---|
| `auftrag_id` | `order_id` |
| `teilauftrag_id` | `sub_order_id` |
| `person_id` | `user_id` |
| `erstellt_am` | `created_at` |

### `history`

| Old | New |
|---|---|
| `auftrag_id` | `order_id` |
| `teilauftrag_id` | `sub_order_id` |
| `ereignisart` | `event_type` |
| `person_id` | `user_id` |
| `begruendung` | `reason` |
| `erstellt_am` | `created_at` |

### `customers`

| Old | New | Notes |
|---|---|---|
| `telefon` | `phone` | |
| `notiz` | `note` | |
| `archiviert` | `is_archived` | boolean → `is_` prefix |
| `erstellt_am` | `created_at` | |
| `strasse` | `street` | |
| `hausnummer` | `house_number` | |
| `plz` | `postal_code` | |
| `ort` | `city` | |

### `stamp_stock_movements`

| Old | New |
|---|---|
| `modell_id` | `model_id` |
| `menge` | `quantity` |
| `typ` | `type` |
| `notiz` | `note` |
| `person_id` | `user_id` |
| `erstellt_am` | `created_at` |

### `product_files`

| Old | New |
|---|---|
| `produkt_id` | `product_id` |
| `datei_id` | `file_id` |
| `erstellt_am` | `created_at` |

### `stamp_models`

| Old | New | Notes |
|---|---|---|
| `typ` | `type` | |
| `max_breite_mm` | `max_width_mm` | |
| `max_hoehe_mm` | `max_height_mm` | |
| `druckflaeche` | `print_area` | |
| `artikelnummer` | `article_number` | |
| `bestand` | `stock` | |
| `mindestbestand` | `min_stock` | |
| `aktiv` | `is_active` | boolean → `is_` prefix |
| `notiz` | `note` | |
| `erstellt_am` | `created_at` | |
| `vk_preis_netto` | `net_price` | |
| `ersatzkissen_artikelnummer` | `replacement_pad_article_number` | |
| `groesse` | `size` | |
| `farbe` | `color` | |

### `sub_orders`

| Old | New | Notes |
|---|---|---|
| `auftrag_id` | `order_id` | |
| `bereich` | `department` | |
| `typ` | `type` | |
| `termin` | `deadline` | |
| `lieferung` | `delivery` | |
| `prioritaet` | `priority` | |
| `verantwortlicher_id` | `assignee_id` | more standard English term |
| `satzzeit_minuten` | `typesetting_minutes` | |
| `datenstatus` | `data_status` | |
| `notfall_aktiv` | `is_emergency` | boolean → `is_` prefix |
| `notfall_begruendung` | `emergency_reason` | |
| `kundenfreigabe_erforderlich` | `customer_approval_required` | |
| `kundenfreigabe_liegt_vor` | `customer_approval_granted` | |
| `kundenfreigabe_datei_id` | `customer_approval_file_id` | |
| `storniert` | `is_cancelled` | boolean → `is_` prefix |
| `sortierung` | `sort_order` | |
| `erstellt_am` | `created_at` | |

### `sub_order_products`

| Old | New |
|---|---|
| `teilauftrag_id` | `sub_order_id` |
| `bereich` | `department` |
| `erstellt_am` | `created_at` |

### `textile_stock_movements`

| Old | New |
|---|---|
| `variante_id` | `variant_id` |
| `menge` | `quantity` |
| `typ` | `type` |
| `notiz` | `note` |
| `person_id` | `user_id` |
| `erstellt_am` | `created_at` |

### `textile_brands`

| Old | New | Notes |
|---|---|---|
| `aktiv` | `is_active` | boolean → `is_` prefix |
| `erstellt_am` | `created_at` | |

### `textile_motifs`

| Old | New |
|---|---|
| `teilauftrag_id` | `sub_order_id` |
| `typ` | `type` |
| `inhalt` | `content` |
| `farbe` | `color` |
| `schriftklasse` | `font_class` |
| `schriftart` | `font_name` |
| `datei_id` | `file_id` |
| `erstellt_am` | `created_at` |
| `platz` | `placement` |
| `groesse` | `size` |
| `druckart` | `print_method` |

### `textile_positions`

| Old | New |
|---|---|
| `teilauftrag_id` | `sub_order_id` |
| `herkunft` | `origin` |
| `stueckzahl` | `quantity` |
| `typ` | `type` |
| `farbe` | `color` |
| `marke` | `brand` |
| `modell` | `model` |
| `groesse` | `size` |
| `erstellt_am` | `created_at` |
| `variante_id` | `variant_id` |

### `textile_products`

| Old | New | Notes |
|---|---|---|
| `marke_id` | `brand_id` | |
| `artikelnummer` | `article_number` | |
| `beschreibung` | `description` | |
| `aktiv` | `is_active` | boolean → `is_` prefix |
| `erstellt_am` | `created_at` | |
| `veredelungen` | `finishing_options` | |

### `textile_variants`

| Old | New | Notes |
|---|---|---|
| `produkt_id` | `product_id` | |
| `farbe` | `color` | |
| `farbe_hex` | `color_hex` | |
| `groesse` | `size` | |
| `ist_muster` | `is_sample` | already had `is_` prefix shape |
| `bestand` | `stock` | |
| `mindestbestand` | `min_stock` | |
| `aktiv` | `is_active` | boolean → `is_` prefix |
| `erstellt_am` | `created_at` | |

### `textile_assignments`

| Old | New |
|---|---|
| `teilauftrag_id` | `sub_order_id` |
| `motiv_id` | `motif_id` |
| `erstellt_am` | `created_at` |

---

## Enum Types

| Old (German) | New (English) |
|---|---|
| `auftrag_status` | `order_status` |
| `datei_rolle` | `file_role` |
| `historie_ereignis` | `history_event` |
| `lieferung_typ` | `delivery_type` |
| `prioritaet_typ` | `priority_type` |
| `teilauftrag_bereich` | `sub_order_department` |
| `textil_herkunft` | `textile_origin` |
| `textil_motiv_typ` | `textile_motif_type` |
| `textil_schriftklasse` | `textile_font_class` |

---

## Functions (RPC)

### Called from the service layer — must update `.rpc()` call sites

| Old (German) | New (English) | Called from |
|---|---|---|
| `fn_berechne_auftragsstatus` | `fn_calculate_order_status` | `src/lib/orderStatus.ts` / order service |
| `dupliziere_auftrag` | `duplicate_order` | order service (duplicate flow) |

### Function parameters — must update named-argument objects in `.rpc()` calls

`duplicate_order`:

| Old | New |
|---|---|
| `p_auftrag_id` | `source_order_id` |
| `p_prioritaet` | `new_priority` |
| `p_lieferung` | `new_delivery` |
| `p_termin` | `new_deadline` |
| `p_teilauftrag_ids` | `selected_sub_order_ids` |
| `p_user_id` | `created_by_user_id` |

`fn_calculate_order_status`:

| Old | New |
|---|---|
| `p_auftrag_id` | `target_order_id` |

### Trigger functions (not called from the service layer)

| Old | New |
|---|---|
| `check_textil_platz_konflikt` | `check_textile_placement_conflict` |
| `fn_check_dateien_versionierung_auftrag` | `fn_check_file_versioning_order` |
| `fn_check_kf_datei_auftrag` | `fn_check_approval_file_order` |
| `fn_check_teilauftrag_gehoert_zu_auftrag` | `fn_check_sub_order_belongs_to_order` |
| `fn_check_teilauftrag_typ` | `fn_check_sub_order_type` |
| `fn_check_textil_motiv_datei` | `fn_check_textile_motif_file` |
| `fn_check_textil_zuordnung_konsistenz` | `fn_check_textile_assignment_consistency` |
| `fn_generate_auftragsnummer` | `fn_generate_order_number` |

---

## Enum Values

### `order_status`

| Old | New |
|---|---|
| `ANGEBOT` | `QUOTE` |
| `UNVOLLSTAENDIG` | `INCOMPLETE` |
| `PREPRESS_BEREIT` | `PREPRESS_READY` |
| `PRODUKTION_BEREIT` | `PRODUCTION_READY` |
| `FERTIG` | `DONE` |
| `ABGERECHNET` | `INVOICED` |

### `file_role`

| Old | New |
|---|---|
| `PRODUKTIONSDATEI` | `PRODUCTION_FILE` |
| `VORSCHAU` | `PREVIEW` |
| `KUNDENFREIGABE` | `CUSTOMER_APPROVAL` |
| `REFERENZ` | `REFERENCE` |

### `history_event`

| Old | New |
|---|---|
| `AUFTRAG_ERSTELLT` | `ORDER_CREATED` |
| `IN_BEARBEITUNG_GENOMMEN` | `PROCESSING_STARTED` |
| `PREPRESS_BEREIT_AUTO` | `PREPRESS_READY_AUTO` |
| `PREPRESS_BEREIT_MANUELL` | `PREPRESS_READY_MANUAL` |
| `PRODUKTION_BEREIT_GESETZT` | `PRODUCTION_READY_SET` |
| `FERTIG_GEMELDET` | `MARKED_DONE` |
| `NOTFALL_AUSGELOEST` | `EMERGENCY_TRIGGERED` |
| `KUNDENFREIGABE_AKTIVIERT` | `CUSTOMER_APPROVAL_ACTIVATED` |
| `KUNDENFREIGABE_ERTEILT` | `CUSTOMER_APPROVAL_GRANTED` |
| `KUNDENFREIGABE_VERFALLEN` | `CUSTOMER_APPROVAL_EXPIRED` |
| `KUNDENFREIGABE_UEBERGANGEN` | `CUSTOMER_APPROVAL_BYPASSED` |
| `RUECKSPRUNG` | `ROLLED_BACK` |
| `STORNIERT` | `CANCELLED` |
| `ERP_EXPORTIERT` | `ERP_EXPORTED` |

### `delivery_type`

| Old | New |
|---|---|
| `ABHOLUNG` | `PICKUP` |
| `VERSAND` | `SHIPPING` |

### `priority_type`

| Old | New |
|---|---|
| `HOCH` | `HIGH` |
| `NORMAL` | `NORMAL` (unchanged) |

### `sub_order_department`

| Old | New |
|---|---|
| `LFP` | `LFP` (unchanged — industry abbreviation) |
| `COPYSHOP` | `COPYSHOP` (unchanged — industry term) |
| `TEXTIL` | `TEXTILE` |
| `STEMPEL` | `STAMP` |
| `LASERGRAVUR` | `LASER_ENGRAVING` |
| `SONSTIGE` | `OTHER` |

### `textile_origin`

| Old | New |
|---|---|
| `KUNDENWARE` | `CUSTOMER_STOCK` |
| `EIGENWARE` | `OWN_STOCK` |

### `textile_motif_type`

| Old | New |
|---|---|
| `DATEI` | `FILE` |
| `TEXT` | `TEXT` (unchanged) |

### `textile_font_class`

| Old | New |
|---|---|
| `SERIFENLOS` | `SANS_SERIF` |
| `SERIFEN` | `SERIF` |
| `ELEGANT` | `ELEGANT` (unchanged) |
| `VERSPIELT` | `PLAYFUL` |

---

## TEXT Check-Constraint Values

### Stamp / ink-pad color (`stamp_models.color`)

| Old | New |
|---|---|
| `SCHWARZ` | `BLACK` |
| `ROT` | `RED` |
| `BLAU` | `BLUE` |
| `GRUEN` | `GREEN` |

### Size (`stamp_models.size`, `textile_motifs.size`)

| Old | New |
|---|---|
| `KLEIN` | `SMALL` |
| `MITTEL` | `MEDIUM` |
| `GROSS` | `LARGE` |

### Stamp model type (`stamp_models.type`)

| Old | New |
|---|---|
| `TRODAT_PRINTY` | `TRODAT_PRINTY` (unchanged — brand name) |
| `HOLZSTEMPEL` | `WOODEN_STAMP` |
| `STATIVSTEMPEL` | `STAND_STAMP` |
| `DATUMSSTEMPEL` | `DATE_STAMP` |
| `STEMPELKISSEN_PRODUKT` | `INK_PAD_PRODUCT` |
| `TRODAT_KISSEN` | `TRODAT_PAD` |

### Movement type (`stamp_stock_movements.type`, `textile_stock_movements.type`)

| Old | New |
|---|---|
| `ZUGANG` | `INBOUND` |
| `ABGANG` | `OUTBOUND` |
| `AUTOABGANG` | `AUTO_DEDUCTION` |

### ERP export mode (`erp_exports.mode`)

| Old | New |
|---|---|
| `EINZELN` | `SINGLE` |
| `GESAMMELT` | `BULK` |

### Sub-order type (`sub_orders.type`) — by department

**STAMP:**

| Old | New |
|---|---|
| `TRODAT_PRINTY` | `TRODAT_PRINTY` (unchanged — brand name) |
| `HOLZSTEMPEL` | `WOODEN_STAMP` |
| `STATIVSTEMPEL` | `STAND_STAMP` |
| `DATUMSSTEMPEL` | `DATE_STAMP` |
| `SONSTIGE_STEMPEL` | `OTHER_STAMP` |
| `NACHFUELLFARBE` | `REFILL_INK` |
| `STEMPELKISSEN` | `INK_PAD` |
| `STEMPELPLATTE` | `STAMP_PLATE` |
| `TRODAT_KISSEN` | `TRODAT_PAD` |

**LFP:**

| Old | New |
|---|---|
| `AUFKLEBER` | `STICKER` |
| `SCHILD_UV` | `SIGN_UV` |
| `SCHILD_FOLIE` | `SIGN_FOIL` |
| `FOLIENPLOTT` | `FOIL_PLOTTER` |
| `BANNER` | `BANNER` (unchanged) |
| `ROLLUP` | `ROLLUP` (unchanged) |
| `FAHRZEUGBESCHRIFTUNG` | `VEHICLE_LETTERING` |
| `SONSTIGE_LFP` | `OTHER_LFP` |

**COPYSHOP:**

| Old | New |
|---|---|
| `PLAKAT_POSTER` | `POSTER` |
| `KARTE_FLYER` | `CARD_FLYER` |
| `FALZFLYER` | `FOLDED_FLYER` |
| `BROSCHUERE` | `BROCHURE` |
| `VISITENKARTE` | `BUSINESS_CARD` |
| `BINDUNG` | `BINDING` (unchanged) |
| `AUSDRUCK` | `PRINTOUT` |

**LASER_ENGRAVING:**

| Old | New |
|---|---|
| `SCHILD` | `SIGN` |
| `POKALSCHILD` | `TROPHY_PLATE` |
| `NAMENSSCHILD` | `NAME_TAG` |
| `GESCHENKARTIKEL` | `GIFT_ITEM` |
| `SONSTIGE_LASER` | `OTHER_LASER` |

**OTHER:**

| Old | New |
|---|---|
| `SONSTIGE` | `OTHER` |

### Textile placement default (`textile_motifs.placement`)

| Old | New |
|---|---|
| `BRUST_LINKS` | `CHEST_LEFT` |

---

## Service Layer Update Checklist

### Table / RPC renames

| Service file | `.from()` / `.rpc()` to update |
|---|---|
| `orderService.ts` | `auftraege` → `orders`; `kunden` → `customers`; `teilauftraege` → `sub_orders`; RPC `fn_berechne_auftragsstatus` → `fn_calculate_order_status`; RPC `dupliziere_auftrag` → `duplicate_order` |
| `subOrderService.ts` | `teilauftraege` → `sub_orders` |
| `customerService.ts` | `kunden` → `customers` |
| `fileService.ts` | `dateien` → `files` |
| `historyService.ts` | `historie` → `history` |
| `erpService.ts` | `erp_exporte` → `erp_exports` |
| `stampService.ts` | `stempel_modelle` → `stamp_models`; `lager_bewegungen` → `stamp_stock_movements` |
| `textileService.ts` | `textil_motive` → `textile_motifs`; `textil_positionen` → `textile_positions`; `textil_zuordnungen` → `textile_assignments`; `textil_produkte` → `textile_products`; `textil_varianten` → `textile_variants` |
| `textileMasterDataService.ts` | `textil_lager_bewegungen` → `textile_stock_movements`; `textil_marken` → `textile_brands`; `textil_produkte` → `textile_products`; `textil_varianten` → `textile_variants`; `textil_positionen` → `textile_positions` |
| `subOrderProductService.ts` | `teilauftrag_produkte` → `sub_order_products`; `produkt_dateien` → `product_files` |
| `employeeService.ts` | `mitarbeiter` → `employees`; `profile` → `profiles` |

### RPC named-argument objects

The `duplicate_order` RPC is called with named arguments that must match the new parameter names:

```ts
// Before
supabase.rpc('dupliziere_auftrag', {
  p_auftrag_id: id,
  p_prioritaet: priority,
  p_lieferung: delivery,
  p_termin: deadline,
  p_teilauftrag_ids: subOrderIds,
  p_user_id: userId,
})

// After
supabase.rpc('duplicate_order', {
  source_order_id: id,
  new_priority: priority,
  new_delivery: delivery,
  new_deadline: deadline,
  selected_sub_order_ids: subOrderIds,
  created_by_user_id: userId,
})
```

The `fn_calculate_order_status` RPC argument:

```ts
// Before
supabase.rpc('fn_berechne_auftragsstatus', { p_auftrag_id: id })
// After
supabase.rpc('fn_calculate_order_status', { target_order_id: id })
```

### High-impact cross-cutting columns

Every service file that reads or writes these columns must be updated:

| Old column | New column | Appears in |
|---|---|---|
| `auftrag_id` | `order_id` | `files`, `erp_exports`, `errors`, `history` |
| `teilauftrag_id` | `sub_order_id` | `errors`, `history`, `sub_order_products`, `textile_motifs`, `textile_positions`, `textile_assignments` |
| `kunde_id` | `customer_id` | `orders` |
| `auftragsnummer` | `order_number` | `orders` |
| `erstellt_am` | `created_at` | every table |
| `erstellt_von` | `created_by` | `orders`, `files` |
| `archiviert` | `is_archived` | `orders`, `customers` |
| `storniert` | `is_cancelled` | `sub_orders` |
| `notfall_aktiv` | `is_emergency` | `orders`, `sub_orders` |
| `aktiv` | `is_active` | `stamp_models`, `textile_brands`, `textile_products`, `textile_variants` |
| `erp_exportiert` | `is_erp_exported` | `orders` |
| `bereich` | `department` | `sub_orders`, `sub_order_products` |
| `verantwortlicher_id` | `assignee_id` | `sub_orders` |
| `kundenfreigabe_erforderlich` | `customer_approval_required` | `sub_orders` |
| `kundenfreigabe_liegt_vor` | `customer_approval_granted` | `sub_orders` |
| `kundenfreigabe_datei_id` | `customer_approval_file_id` | `sub_orders` |
| `notfall_begruendung` | `emergency_reason` | `sub_orders` |
| `variante_id` | `variant_id` | `textile_positions`, `textile_stock_movements` |
| `motiv_id` | `motif_id` | `textile_assignments` |
| `datei_id` | `file_id` | `product_files`, `textile_motifs` |
| `person_id` | `user_id` | `errors`, `history`, `stamp_stock_movements`, `textile_stock_movements` |
| `menge` | `quantity` | `stamp_stock_movements`, `textile_stock_movements` |
| `typ` | `type` | `stamp_models`, sub-order and textile tables |
| `rolle` | `role` | `files` |
| `anzeigename` | `display_name` | `files` |
| `pfad` | `path` | `files` |
| `thumbnail_pfad` | `thumbnail_path` | `files` |
| `ersetzt_datei_id` | `replaces_file_id` | `files` |
| `exportdaten` | `export_data` | `erp_exports` |
| `modus` | `mode` | `erp_exports` |
| `exportiert_am` | `exported_at` | `erp_exports` |
| `exportiert_von` | `exported_by` | `erp_exports` |
| `telefon` | `phone` | `customers` |
| `notiz` | `note` | `customers`, `stamp_models`, stock movement tables |
| `strasse` | `street` | `customers` |
| `hausnummer` | `house_number` | `customers` |
| `plz` | `postal_code` | `customers` |
| `ort` | `city` | `customers` |
| `kaufmaennische_notiz` | `billing_note` | `orders` |
| `ereignisart` | `event_type` | `history` |
| `begruendung` | `reason` | `history` |
| `modell_id` | `model_id` | `stamp_stock_movements` |
| `produkt_id` | `product_id` | `product_files`, `textile_variants` |
| `marke_id` | `brand_id` | `textile_products` |
| `variante_id` | `variant_id` | `textile_positions`, `textile_stock_movements` |
| `marke` | `brand` | `textile_positions` |
| `modell` | `model` | `textile_positions` |
| `herkunft` | `origin` | `textile_positions` |
| `stueckzahl` | `quantity` | `textile_positions` |
| `inhalt` | `content` | `textile_motifs` |
| `schriftklasse` | `font_class` | `textile_motifs` |
| `schriftart` | `font_name` | `textile_motifs` |
| `platz` | `placement` | `textile_motifs` |
| `druckart` | `print_method` | `textile_motifs` |
| `groesse` | `size` | `stamp_models`, `textile_motifs`, `textile_positions`, `textile_variants` |
| `farbe` | `color` | `stamp_models`, `textile_motifs`, `textile_positions`, `textile_variants` |
| `farbe_hex` | `color_hex` | `textile_variants` |
| `ist_muster` | `is_sample` | `textile_variants` |
| `bestand` | `stock` | `stamp_models`, `textile_variants` |
| `mindestbestand` | `min_stock` | `stamp_models`, `textile_variants` |
| `max_breite_mm` | `max_width_mm` | `stamp_models` |
| `max_hoehe_mm` | `max_height_mm` | `stamp_models` |
| `druckflaeche` | `print_area` | `stamp_models` |
| `vk_preis_netto` | `net_price` | `stamp_models` |
| `ersatzkissen_artikelnummer` | `replacement_pad_article_number` | `stamp_models` |
| `artikelnummer` | `article_number` | `stamp_models`, `textile_products` |
| `beschreibung` | `description` | `textile_products` |
| `veredelungen` | `finishing_options` | `textile_products` |
| `satzzeit_minuten` | `typesetting_minutes` | `sub_orders` |
| `datenstatus` | `data_status` | `sub_orders` |
| `sortierung` | `sort_order` | `sub_orders` |
| `termin` | `deadline` | `orders`, `sub_orders` |
| `lieferung` | `delivery` | `orders`, `sub_orders` |
| `prioritaet` | `priority` | `orders`, `sub_orders` |
| `produkt_id` | `product_id` | `product_files` |

### Also update

- `src/lib/orderStatus.ts` — RPC call: `fn_berechne_auftragsstatus` → `fn_calculate_order_status`; argument key `p_auftrag_id` → `target_order_id`
- `src/const/orderSelect.ts` — join alias `kunden(...)` → `customers(...)`; all selected column names
- `src/const/subOrderSelect.ts` — all selected column names
- `src/types/supabase.ts` — regenerate with `supabase gen types typescript` after applying migration
