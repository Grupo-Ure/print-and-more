# Test Plan

The end-to-end suite as it is meant to be: one bullet per page, feature,
test pack and test. **This file is the source of truth** — a test exists
because it is listed here, and a test that is written without being listed
fails `npm run test:plan:check` (run in CI). Change the suite by editing this
file first; a spec follows the plan, never the other way round.

- A **pack** is one spec file under [e2e/](./) covering one sub-feature:
  `[file](path) — \`PREFIX\``, the path relative to this file. The prefix
  starts every test ID of the pack.
- A bullet in *italics* is a `describe` block — the precondition the tests
  inside it share. A spec test sits inside the same chain of describes.
- A test bullet is `**<PREFIX>-<NNN>** <title>`, the title being the one the
  spec uses word for word. Add a new test without the ID and run
  `npm run test:plan:assign` to number it; IDs are never reused — a deleted
  test leaves its number retired, a reworded test keeps its ID.
- `npm run test:plan:status` lists what is planned and not yet written.

How a run works is in [e2e/README.md](README.md); the conventions are in
[docs/testing/](../docs/testing/). The detailed plan behind the orders page is
[e2e/orders-page-test-plan.md](orders-page-test-plan.md), and the
behaviour the lifecycle packs assert is written out in
[e2e/order-lifecycle-and-visibility.md](order-lifecycle-and-visibility.md).

- **Auth**
  - [auth.spec.ts](auth/auth.spec.ts) — `AUTH-LOGIN`
    - *signed out*
      - **AUTH-LOGIN-001** signing in with email and password shows the user in the navbar
    - *as employee*
      - **AUTH-LOGIN-002** signing in renders exactly the navigation links of the role
    - *as admin*
      - **AUTH-LOGIN-003** signing in renders exactly the navigation links of the role
- **Orders page**
  - **Sidebar**
    - [sidebar.spec.ts](orders-page/sidebar.spec.ts) — `ORD-SIDE`
      - **ORD-SIDE-001** selecting a listed order in the sidebar opens its details
  - **Order**
    - [new-order.spec.ts](orders-page/order/new-order.spec.ts) — `ORD-NEW`
      - **ORD-NEW-001** creating an order for an existing customer opens it as a quote for that customer
      - **ORD-NEW-002** creating an order with a customer created in the dialog opens it as a quote for that customer
      - **ORD-NEW-003** creating an order pre-fills its deadline one week out
    - [header.spec.ts](orders-page/order/header.spec.ts) — `ORD-HDR`
      - *customer with every contact and address field set*
        - **ORD-HDR-001** the header shows the order number and the customer's name, email, phone and address
        - **ORD-HDR-002** the copy button next to the order number puts it on the clipboard
        - **ORD-HDR-003** the copy button next to the email puts it on the clipboard
        - **ORD-HDR-004** the copy button next to the phone number puts it on the clipboard
        - **ORD-HDR-005** the copy button next to the address puts it on the clipboard
    - [settings.spec.ts](orders-page/order/settings.spec.ts) — `ORD-SET`
      - **ORD-SET-001** picking a date in the deadline calendar sets it as the order deadline
    - [status.spec.ts](orders-page/order/status.spec.ts) — `ORD-STA`
      - **ORD-STA-001** starting processing a quote moves the order to in progress
      - *quote with deadline and delivery, one product in every department*
        - **ORD-STA-002** starting processing promotes every product to pre-press
      - *in progress, the only product in production*
        - **ORD-STA-003** marking the last product done finishes the order on its own
      - *in progress, one product done and one in production*
        - **ORD-STA-004** the order stays in progress with no lifecycle action while a product is still open
        - **ORD-STA-005** marking the remaining product done finishes the order on its own
      - *in progress cash order, the only product in production*
        - **ORD-STA-006** marking the last product done leaves the cash order in progress, offering to finish and close it
      - *in progress, every product done*
        - **ORD-STA-007** marking the order finished moves it to finished
      - *finished, every product done*
        - **ORD-STA-008** marking the order as invoiced closes it and keeps it in the order list
      - *as admin, finished, every product done*
        - **ORD-STA-009** reopening the order moves it back to in progress
        - **ORD-STA-010** reopening the order leaves it open, with finishing it again a manual step
      - *in progress cash order, every product done*
        - **ORD-STA-011** finishing the cash order closes it in one step and keeps it in the order list
    - [remove.spec.ts](orders-page/order/remove.spec.ts) — `ORD-REM`
      - **ORD-REM-001** archiving an order removes it from the order list
      - **ORD-REM-002** cancelling an order removes it from the order list
      - **ORD-REM-003** deleting a quote from its row menu removes it from the order list
    - [duplicate.spec.ts](orders-page/order/duplicate.spec.ts) — `ORD-DUP`
      - **ORD-DUP-001** duplicating the order opens the copy as a new quote, selected in the list
      - **ORD-DUP-002** duplicating the order carries its product and spec into the copy
      - **ORD-DUP-003** deselecting every product leaves the duplicate unsubmittable
    - [emails.spec.ts](orders-page/order/emails.spec.ts) — `ORD-EML`
      - *mail not due for an hour*
        - **ORD-EML-001** opening the emails tab lists the mail as waiting to go
      - **ORD-EML-002** opening the emails tab lists a drained mail as sent
      - **ORD-EML-003** viewing a sent mail opens it as it went out
      - *message naming an unknown template*
        - **ORD-EML-004** opening the emails tab lists the given-up mail as failed
  - **Product**
    - [add-remove.spec.ts](orders-page/product/add-remove.spec.ts) — `PRD-ADD`
      - **PRD-ADD-001** adding a product through its department form selects it in the list
      - **PRD-ADD-002** the draft product is listed while it is being filled in
      - **PRD-ADD-003** cancelling the draft product adds nothing to the order
      - **PRD-ADD-004** a department of several product types offers them before the draft starts
      - *in progress, its only product done*
        - **PRD-ADD-005** a draft product does not count as work still open on the order
      - **PRD-ADD-006** deleting a product in setup removes it from the order and records the deletion
      - *in progress, product in pre-press*
        - **PRD-ADD-007** cancelling a product past setup removes it from the order and records the cancellation
        - **PRD-ADD-008** cancelling the only product leaves the order in progress
      - *in progress, one product done and one in pre-press*
        - **PRD-ADD-009** cancelling the pre-press product finishes the order on its own
      - *in progress without a deadline, one product done and one in setup*
        - **PRD-ADD-010** deleting the setup product finishes the order on its own
    - [basic-info.spec.ts](orders-page/product/basic-info.spec.ts) — `PRD-INF`
      - **PRD-INF-001** the product's saved spec is shown read-only, with no way to submit it
      - **PRD-INF-002** editing the description and saving it shows the new value on the closed form
      - **PRD-INF-003** cancelling an edit leaves the saved description in place
      - *in progress, product in production*
        - **PRD-INF-004** the released product offers no way to edit its spec
        - **PRD-INF-005** writing the released product's typed spec row as the signed-in user is refused
        - **PRD-INF-006** writing the released product's quantity as the signed-in user is refused
    - [status.spec.ts](orders-page/product/status.spec.ts) — `PRD-STA`
      - *in progress, product without a deadline*
        - **PRD-STA-001** setting the order deadline completes the product and promotes it to pre-press
      - *in progress, LFP product*
        - **PRD-STA-002** the product is promoted to pre-press on its own
      - *in progress, CopyShop product*
        - **PRD-STA-003** the product is promoted to pre-press on its own
      - *in progress, textile batch*
        - **PRD-STA-004** the product is promoted to pre-press on its own
      - *in progress, stamp product*
        - **PRD-STA-005** the product is promoted to pre-press on its own
      - *in progress, laser-engraving product*
        - **PRD-STA-006** the product is promoted to pre-press on its own
      - *in progress, OTHER product*
        - **PRD-STA-007** the product is promoted to pre-press on its own
      - *in progress, product whose deadline has passed*
        - **PRD-STA-008** the product is promoted to pre-press on its own
      - *in progress, product in pre-press*
        - **PRD-STA-009** releasing the product to production moves it to in production
      - *in progress, product in production*
        - **PRD-STA-010** marking the product as done moves it to done
      - *in progress, OTHER product, pre-press default set*
        - **PRD-STA-011** the product promoted to pre-press is assigned to the pre-press default
      - *in progress, product in pre-press, production default set*
        - **PRD-STA-012** releasing the product to production assigns it to the production default
        - **PRD-STA-013** releasing the product to production records the assignee change in the order history
      - *in progress, product in production, pre-press default set*
        - **PRD-STA-014** sending the product back to pre-press assigns it to the pre-press default
    - [release-gates.spec.ts](orders-page/product/release-gates.spec.ts) — `PRD-GAT`
      - *in progress, product with no deadline*
        - **PRD-GAT-001** the product is held in setup with the release blocked
      - *in progress, product in pre-press awaiting customer approval*
        - **PRD-GAT-002** the release to production is blocked
        - **PRD-GAT-003** granting the approval against a file unblocks the release to production
      - *in progress, stamp product in pre-press, model out of stock*
        - **PRD-GAT-004** the shortage is shown and the release to production is blocked
      - *as admin, in progress, product with no deadline*
        - **PRD-GAT-005** opening the force release prompt without a reason keeps it unsubmittable
        - **PRD-GAT-006** force releasing the product with a reason moves it to production flagged as missing information
        - **PRD-GAT-007** force releasing the product records an emergency entry in the order history
    - [stock-deduction.spec.ts](orders-page/product/stock-deduction.spec.ts) — `PRD-STK`
      - *in progress, stamp product in pre-press, model in stock*
        - **PRD-STK-001** releasing the product to production deducts its quantity from the model stock
        - **PRD-STK-002** marking the product done after the release deducts nothing more
      - *in progress, textile batch in pre-press, variant in stock*
        - **PRD-STK-003** releasing the batch to production deducts its garment line's quantity from the variant stock
        - **PRD-STK-004** marking the batch done after the release deducts nothing more
- **Production page**
  - [feed.spec.ts](production-page/feed.spec.ts) — `PRN-FEED`
    - *as admin*
      - *with a product in pre-press*
        - **PRN-FEED-001** opening the production page lists the product
        - **PRN-FEED-002** selecting a product in the feed shows its detail beside the feed
        - **PRN-FEED-003** the panel above the detail names the product's order
        - **PRN-FEED-004** opening a product in the orders view from its panel switches to that view
        - **PRN-FEED-005** releasing the product to production from the feed keeps it listed, now in production
      - *with a product in production*
        - **PRN-FEED-006** opening the production page lists the product
    - *as admin, order without a deadline*
      - **PRN-FEED-007** opening the production page leaves a product still in setup out
    - *as employee*
      - **PRN-FEED-008** widening the assignee filter to everyone lists products assigned to nobody
      - **PRN-FEED-009** opening the assignee filter leaves a developer account out of the list
- **Settings page**
  - [departments.spec.ts](settings-page/departments.spec.ts) — `SET-DEP`
    - *pre-press slot empty*
      - **SET-DEP-001** picking a user as the pre-press default stores it on the row
    - *production slot empty*
      - **SET-DEP-002** picking a user as the production default stores it on the row
    - *pre-press slot held by the admin*
      - **SET-DEP-003** choosing unassigned clears the pre-press default from the row
  - [emails.spec.ts](settings-page/emails.spec.ts) — `SET-EML`
    - **SET-EML-001** setting a delay makes the next mail queued for it wait that many days
    - **SET-EML-002** switching a mail off makes queuing it queue nothing
  - [approval.spec.ts](settings-page/approval.spec.ts) — `SET-APR`
    - **SET-APR-001** changing the approval expiry shows the new value again after reopening Settings
    - **SET-APR-002** opening Settings lists the customer approval section
- **Email runtime**
  - **Transport**
    - [transport.spec.ts](email-runtime/transport.spec.ts) — `EML-TRN`
      - **EML-TRN-001** draining the queue turns the queued message into a sent record and takes it off the queue
      - **EML-TRN-002** draining the queue a second time sends nothing twice
      - *message not due for an hour*
        - **EML-TRN-003** draining the queue leaves the message waiting unsent
        - **EML-TRN-004** making the message due and draining the queue sends it
      - **EML-TRN-005** calling the drain with a user session instead of the service-role key is refused
      - *message naming an unknown template*
        - **EML-TRN-006** draining the queue archives the message with a failure entry on the order
      - *message whose template says it is no longer needed*
        - **EML-TRN-007** draining the queue archives the message unsent
      - *message the provider refuses*
        - **EML-TRN-008** a refused send leaves the message on the queue with nothing recorded
        - **EML-TRN-009** the last allowed refusal archives the message with a failure entry on the order
  - **Settings**
    - [settings.spec.ts](email-runtime/settings.spec.ts) — `EML-SET`
      - *test-message repeated once a day, sent twice at most*
        - **EML-SET-001** sending the mail queues its repeat one repeat interval out
        - **EML-SET-002** draining each send as it comes due stops the mail at its maximum
      - **EML-SET-003** draining the queue archives unsent a waiting mail switched off since it was queued
  - **Webhook**
    - [webhook.spec.ts](email-runtime/webhook.spec.ts) — `EML-WHK`
      - **EML-WHK-001** a delivery report marks the sent mail as delivered
      - **EML-WHK-002** a bounce report marks the sent mail as bounced with the provider's reason
      - **EML-WHK-003** a bounce report writes a bounce entry on the order's history
      - **EML-WHK-004** a bounce report flags the customer's address as bounced
      - **EML-WHK-005** the same bounce report delivered twice writes one history entry
      - **EML-WHK-006** changing the customer's email address clears the bounce flag
      - **EML-WHK-007** a report signed with another secret is refused and marks nothing

## Later

Areas not yet broken down into tests. When one is, its tests go into the
tree above as bullets under a pack.

- **Orders page — sidebar search and filters** (cases in
  [the plan, section 10](orders-page-test-plan.md)): search (customer
  name, substring, case-insensitive; clear; empty state; compact layout
  toggle); status filter (defaults; untick one status; all statuses; none
  ticked; reset); show archived (archived quote hidden / listed; billed order
  listed regardless); department filter (one department, two departments,
  reset); deadline and intake filter (inclusive bounds; no deadline hidden
  while a bound is set; reset); assignee filter (one user, unassigned,
  reset); filters across groups (combine as AND; changed-dot on the toggle;
  no persistence; selection survives filtering).
- **Not yet planned in detail** (from [the plan](orders-page-test-plan.md)):
  order settings and product overrides, files, history, time logs, role
  differences, compact layout, stock pages, profile page.
