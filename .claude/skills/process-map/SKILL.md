---
name: process-map
description: Build a human process map in Lucidchart for one Print And More department or process (e.g. "stamp", "copy shop", "the order as a whole") following the house conventions — actor lanes, phase columns, need-focused cards, status only as a small tag. Use when the user asks for a process map, a Lucid chart of how a department works, or to "map the <department> process". One map per run, built by hand from the reference spec, verified by render.
---

# Process map (Lucidchart)

Build one process map that the shop owner can read: who does what, in which
phase, to get an order from request to hand-over. The map is the **input for
designing the app**, not a description of the app. It describes the shop's
process as it should work; the app is then shaped to serve it.

## Arguments

- **Process** — required: the department or process to map ("stamp",
  "textile", "LFP", "the order"). If missing, ask.
- **Known steps** — optional: the user often dictates the intake steps in
  their message. Use them; do not re-derive them from code. The department
  notes below are hints for what to propose when the user has not spoken.

## Application context

**The shop.** Print And More is a print and advertising shop. One small team
takes orders at the front desk (counter, mail, phone) and produces them in
six departments: **LFP** (large format: stickers, signs, foil, banners,
roll-ups, vehicle lettering, often installed on site), **Copy Shop**
(posters, flyers, brochures, business cards, binding, printouts),
**Textile** (printed or embroidered garments), **Stamp** (Trodat and wooden
stamps, plates, ink, pads), **Laser engraving** (signs, trophy plates, name
tags, gift items) and **Other** (anything that fits nowhere else). Two fixed
roles from the prototype: **MK ships**, **SJ invoices**. Invoicing and
accounting live in **sevDesk**, the register in **ready2order**; both are
outside the app.

**The unit of work is the product.** The job layer is being removed
([.plans/JOB_ELIMINATION.md](../../../.plans/JOB_ELIMINATION.md)): an order
holds products directly, each product belongs to one department, has its own
status, assignee and deadline, and is worked on its own. A Textile product is
a **batch**: several garment lines (model, colour, quantity per size) that
share the same designs in the same placements. Maps describe this target
model, never the old job vocabulary.

**The shared shape of every order** (the order map, not yet built):
customer asks → front desk captures who, what, by when, pickup or shipping,
invoice or cash → optional quote and the customer's go → "start processing"
makes the work real and hands each product to its department → the
department takes it through pre-press and production → everything made →
hand-over → invoice (or cash at the register). An invoice order counts as
finished by itself once its last product is done; a cash order is closed at
hand-over. The customer may change or cancel before things are made; the
owner may reopen a finished order.

**Rules that shape every department map**
- The customer's approval of a proof is optional per product; when it is
  required nothing is made before the OK. Show it as a dashed card in the
  Customer lane inside the Pre-press column.
- **Stamp and Textile take items from stock** when the team releases a
  product to production (stamp body and pad; garments per size). The other
  departments keep no stock in the app. Show a stock step only for those two,
  and only if the user wants a "Stock and purchasing" lane.
- The owner may let production start before everything is in place (a rush
  job). Mention it only if the user asks for exceptions.
- Time spent is logged by the team while making things; a production sheet
  per product is printed for the bench.

**Statuses** (for the grey tag under each phase header only): order
QUOTE → IN PROGRESS → FINISHED → BILLED; product IN SETUP → PRE-PRESS →
IN PRODUCTION → DONE. The columns Order intake / Pre-press / Production /
Done and hand-over correspond to the four product statuses.

**Department notes** (hints for intake steps; the user's dictation wins;
grow this section as departments get mapped)
- **Textile** (mapped, see registry): capture the design (drop the file, or
  text with font and colour) → decide placement and print method → select the
  garments (brand, model, colour, quantity per size) → start processing.
  Pre-press and production are still generic; open questions attached.
- **Stamp**: model stamps (Trodat Printy, wooden) are chosen from the catalog
  with an ink colour and the text or logo; stand, date and other stamps are
  captured by size; plates by size; consumables are refill ink, ink pads and
  replacement pads. The plate is lasered and mounted in the team.
- **Copy Shop / LFP / Laser / Other**: the customer brings files or a
  description; intake captures the kind of product, its spec (size, material,
  sides, finishing), quantity and deadline, and collects the files. LFP adds
  on-site installation as part of production. Other is free-form.

**Registry of maps and sources**
- Prototype the client co-authored (format reference, content partly wrong):
  https://claude.ai/artifact/NMQ3HEnBjkpqpXLV7QBVpv
- Textile: order process — https://lucid.app/lucidchart/f59c7cda-2cb5-45ec-9175-bab37396772e/edit
- Add each new map here with its edit link when it is delivered.

## Before building

1. Read `lucid://skills/diagram-specification` (the create tool requires it
   every time) with `ReadMcpResourceTool`, server `claude.ai Lucid`.
2. Read the reference spec in this folder: `reference/textile.json`. Every
   new map starts from it — same geometry, same styles, same legend. Only the
   lanes' names, the steps and the notes change.
3. If the user did **not** supply the steps, send one short message with the
   proposed step list (one line per card, grouped by phase) and wait for the
   go. If they did, build straight away and iterate on the render.
4. Where a phase is not understood yet (e.g. what pre-press means for that
   department), keep the card generic and attach a yellow note "To clarify
   with the client: ...". Never invent detail to fill a gap.

## Conventions (non-negotiable)

**Lanes are people or departments.** Horizontal rows, title bar on the left
(`vertical: false`, `titleBar: {height: 60, verticalText: true}`). Default
lanes, top to bottom: Customer, Front desk, `<Department> team`. Add a fourth
lane (e.g. "Stock and purchasing") only when the user asks for it.

**Phases are columns that cross the lanes.** Four header rectangles above the
swimlane plus dashed vertical divider lines through all lanes:
Order intake · Pre-press · Production · Done and hand-over. The app status is
named **once**, in small grey text under each header (In setup, Pre-press,
In production, Done). Lucid's import has no native phases; the header
rectangles and `positionEndpoint` lines are the way to do it.

**Cards say what has to be achieved.** Bold title (a verb phrase, in the
lane owner's words) plus one or two plain sentences, at most ~110 characters
of body. No form instructions, no "the app does X", no history-event or
column names, no status inside the card. Steps the department team does are
named as the team would ("Prepare the batch", "Make the garments", "Finish").

**Flow reads left to right, one card per column.** Same-lane connectors are
straight; cross-lane connectors are elbow, leaving the right side and
entering the left side. A step that happens only sometimes (customer approves
a proof) gets a dashed border and a dashed grey line that leaves the top of
its source card. Open questions are yellow `note` shapes under the card.

**Legend** at the bottom: dashed = only when needed; yellow note = open
question for the client meeting; columns = phase, grey line = matching app
status.

**Shared skeleton of every department flow** (adapt, do not copy blindly):
customer wants something → front desk captures it (department-specific
intake steps, 2–4 cards) → start processing → team prepares → customer
approves the proof (dashed) → release to production → team makes it →
finish → customer picks up or receives.

## Geometry (from the reference; keep it)

| Element | Value |
|---|---|
| Phase headers | `y: 0, h: 80`; x ranges follow the columns they span |
| Swimlane | `x: 0, y: 120, h: 780` (lanes 220 / 220 / 340); width = `100 + columns * 350 + 50` |
| Cards | `w: 300, h: 160`; `x = 100 + col * 350`; `y = laneTop + 30` (150 / 370 / 590) |
| Notes | `w: 300, h: 90`; `y: 780` under the team card, same x |
| Dividers | `x = 75 + k * 350` at the column boundary, from `y: 80` to `y: 900` |
| Legend | `y: 950`, three boxes starting at `x: 100` |
| Card text | `<p style="font-size:8pt;text-align:left"><b>Title</b><br>Body.</p>` |
| Header text | `<p style="font-size:11pt;text-align:center"><b>Phase</b><br><span style="font-size:8pt;color:#6B7280">status: In setup</span></p>` |

Header fills: intake `#E5E7EB`, pre-press `#FDE68A`, production `#BFDBFE`,
done `#BBF7D0`. Lane header/lane fills: Customer `#F59E0B`/`#FEF9E7`,
Front desk `#3B82F6`/`#EEF4FF`, team `#22C55E`/`#EDF9F0`. Notes `#FEF3C7`.

## Building

1. Write the Standard Import JSON **by hand** in the tool call (no generator
   script, no multi-page document). Use readable shape ids (`want`, `design`,
   `release`). Escape `&`, `<`, `>` in text; no emoji.
2. Create with `lucid_create_diagram_from_specification`, `product:
   "lucidchart"`, `use_assisted_layout: false`, title
   `"<Department>: order process"`. Preflight warnings about 60 px clearance
   between adjacent cards and text-fit at 8pt are expected; check them in the
   render instead.
3. Verify by rendering: `lucid_export_document_as_PNG` in two halves
   (`x: 0..2000` and `x: 1800..end`, `h: 1020`). Look for clipped text,
   overlapping labels, connectors crossing cards.
4. To change anything, **recreate the document** with the corrected JSON.
   `lucid_edit_item` takes plain text only (HTML renders literally), so
   editing a card in place loses its bold title. Rename the old document
   `"SUPERSEDED (delete me): <title> vN"` with `lucid_update_document`; the
   connector cannot delete documents.

## Delivering

Short message: the edit link, the lanes, the four phases, any judgement call
the user should confirm (e.g. which column "release" sits in), which
superseded documents to delete, and the open questions left for the client.
No restating of the cards. Then add the map to the registry above and, if the
department notes learned something, update them in the same edit.
