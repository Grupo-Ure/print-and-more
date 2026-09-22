# Orders Page — Test Plan (draft)

Rough map of what must work on the orders view. Each top-level item is a
candidate spec; details come later.

## Prerequisites

- Authenticated fixture (employee + admin test users) — done: `fixtures/auth.ts`
- Fresh order per test, cleaned up afterwards — done: `fixtures/orders.ts`
- Known stamp/textile stock for the deduction cases

## 1. Sign in and land — done

- Login → sidebar lists orders → select one → details load
- Specs: `e2e/auth/auth.spec.ts` (sign-in with email/password, navigation per role), `e2e/orders-page/sidebar.spec.ts` (list → select → details)

## 2. Create an order — done

- New Order → pick / create customer → order selected as Quote
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

## Later

- Order settings + job overrides
- Sidebar search / filters
- Files dialog
- History dialog
- Time logs
- Role differences
- Compact layout
