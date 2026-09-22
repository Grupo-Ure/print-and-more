# Orders Page — Test Plan (draft)

Rough map of what must work on the orders view. Each top-level item is a
candidate spec; details come later.

## Prerequisites

- Authenticated fixture (employee + admin test users) — done: `fixtures/auth.ts`
- Fresh order per test, cleaned up afterwards — done: `fixtures/orders.ts`
- Known stamp/textile stock for the deduction cases
- A second order for another customer per test (`otherCustomer` / `otherOrder`), so a filter can list one and hide the other — open
- Job seed with an `assignee_id` (a test user's id, looked up by email) — open
- Order seed with `created_at` (intake range) and `is_archived` (archived quote, billed order); a `BILLED_ORDER` seed becomes valid once billed orders can be listed — open

## 1. Sign in and land — done

- Login → sidebar lists orders → select one → details load
- Specs: `e2e/auth/auth.spec.ts` (sign-in with email/password, navigation per role), `e2e/orders-page/sidebar.spec.ts` (list → select → details)

## 2. Create an order — done

- New Order → pick / create customer → order selected as Quote
- New order defaults: cash payment, deadline today, pickup — open
- Specs: `e2e/orders-page/order/new-order.spec.ts` (existing customer, customer created in the dialog)

## 3. Build the order — done

- Add job → job number, becomes active
- Add product
- Set order deadline
- Specs: `e2e/orders-page/job/add-remove.spec.ts`, `e2e/orders-page/job/products.spec.ts`, `e2e/orders-page/order/settings.spec.ts` (one per bullet, on an OTHER job)

## 4. Start processing → pre-press — done

- Start processing → order In Progress
- Complete job auto-promotes to Prepress
- Manual release for free-form (OTHER_*) jobs
- Specs: `e2e/orders-page/order/status.spec.ts` (start processing), `e2e/orders-page/job/status.spec.ts` (auto-promotion, manual release); the order/job state comes from the `orderSeed` / `jobSeed` options

## 5. Production → done → billed — done

- Release to Production → Mark done
- Mark finished → Mark as invoiced → order archived
- Cash variant: Finish & close
- Specs: `e2e/orders-page/job/status.spec.ts` (release to production, mark done), `e2e/orders-page/order/status.spec.ts` (mark finished, mark invoiced, cash close); the seeds `JOB_IN_PREPRESS` / `JOB_IN_PRODUCTION` / `JOB_DONE` and `FINISHED_ORDER` / `IN_PROGRESS_CASH_ORDER` put the rows in the state each step starts from

## 6. Gates — done

- No deadline / past deadline / no product keeps job in setup
- Customer approval blocks production until granted
- Insufficient stock blocks release
- Admin force release (reason required, history entry, warning icon)
- Specs: `e2e/orders-page/job/release-gates.spec.ts` (the three completeness gates, approval blocked / granted, stock shortage on the out-of-stock stamp model, force release as admin: reason required, status + warning icon, history entry)

## 7. Stock deduction on release — done

- Stamp and textile stock decremented exactly once
- Specs: `e2e/orders-page/job/stock-deduction.spec.ts` (per department: release deducts the quantity; release then mark done deducts nothing more — read off the stock pages as admin, against the catalog rows the `catalog` fixture seeds)

## 8. Remove / undo — done

- Delete job (setup), cancel job (pre-press)
- Archive order, cancel order, delete quote
- Admin reopen finished order
- Specs: `e2e/orders-page/job/add-remove.spec.ts` (delete in setup / cancel in pre-press, each checked against the history), `e2e/orders-page/order/remove.spec.ts` (archive, cancel, delete quote), `e2e/orders-page/order/status.spec.ts` (admin reopen)

## 9. Duplicate order — done

- Copy appears, selected, carries jobs and products
- Specs: `e2e/orders-page/order/duplicate.spec.ts` (the copy opens as a new quote and is selected; it carries the job and its product)

## 10. Sidebar search and filters — open

Header of the sidebar: search box, then the Status / Department / Deadline /
Users popovers and the Show archived toggle. Every case is black-box: act on
the sidebar, assert whether an order's row is listed (or the empty state).

The archived rule changes first (own commit): a **Show archived** header
toggle replaces the archived value derived from the status boxes. Toggle off
lists non-archived orders plus billed ones; toggle on adds archived quotes and
cancelled orders. Billed orders are listed whenever Billed is ticked.

- Search (customer name, substring, case-insensitive)
  - Part of the customer's name lists that order and hides the other customer's
  - Clear (X) brings the full list back
  - No matching customer → empty state
  - Compact layout: the Search toggle reveals the box
- Status (order status, not job status)
  - Default: quote and in-progress listed, finished not
  - Ticking Finished lists a finished order; unticking Quote hides a quote
  - Ticking Billed lists a billed order
  - All statuses lists quote, in-progress, finished and billed at once; the single boxes are disabled meanwhile
  - Unticking every status → empty state
  - Reset restores the defaults
- Show archived
  - Off: an archived quote is hidden; a billed order is still listed when Billed is ticked
  - On: the archived quote is listed; off again hides it
- Department (order has at least one job in a selected department)
  - Two orders, one with a Stamp job and one with a Textile job: selecting Stamp keeps the first listed and hides the second
  - Two departments list either
  - Reset lists everything again
- Deadline / intake (order deadline, order creation day; bounds inclusive)
  - A deadline range around tomorrow lists the in-progress order; a range past it hides it; an order without a deadline is hidden while any bound is set
  - An intake range on today lists a fresh order, hides the order created on a past day
  - Reset clears all four dates
- Users (job assignee)
  - Ticking a user lists the order whose job is assigned to them, hides the unassigned one
  - Unassigned does the reverse
  - Reset lists everything again
- Across groups
  - Filters combine: status and department must both match
  - The dot appears on a group's toggle once it differs from default, gone after Reset
  - No persistence: switching to a stock page and back restores the defaults
  - Hiding the selected order by a filter keeps its details open
- To confirm before writing a spec (visible today; intended or bug?)
  - An order with no jobs disappears under any department or assignee selection
  - Cancelled jobs still count for the department and assignee filters
  - The deadline filter uses the order deadline only; a job's separate deadline is ignored
- Specs (proposed): `e2e/orders-page/sidebar/` — `search.spec.ts`, `status-filter.spec.ts`, `archived.spec.ts`, `department-filter.spec.ts`, `deadline-filter.spec.ts`, `assignee-filter.spec.ts`, `filters.spec.ts` (across groups); `sidebar.spec.ts` moves in as `select.spec.ts` with the first of them. Page objects exist: `OrderSidebarPOM` toggles + `includeStatus()`, `OrderSidebar{Status,Department,Deadline,Users}FilterPOM`

## Later

- Order settings + job overrides
- Files dialog
- History dialog
- Time logs
- Role differences
- Compact layout
