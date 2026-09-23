# Order lifecycle and sidebar visibility

Source of truth for how an order's status, the Cancel and Archive actions,
and the sidebar's status filter and "Show archived" toggle work together.
[orders-page-test-plan.md](orders-page-test-plan.md) lists the specs; this
file states the behaviour they assert. Where the code differs today, the
"Gaps" section at the end says so.

## The four statuses

`order_status`: `QUOTE` → `IN_PROGRESS` → `FINISHED` → `BILLED`. Every step
is a click on the lifecycle button in the order header, with one exception:
an invoice order in progress becomes Finished on its own the moment its last
non-cancelled job is Done (the job marked done, or the last open job cancelled
or deleted). Nothing else moves an order's status automatically; in
particular a reopened order stays In Progress until a job changes again.

| From | Action | To | Condition |
|---|---|---|---|
| Quote | Start processing | In Progress | none |
| In Progress | *(automatic)* | Finished | every non-cancelled job is Done; invoice orders only |
| In Progress | Mark finished | Finished | every non-cancelled job is Done; invoice orders only (manual fallback, e.g. after a reopen) |
| In Progress | Finish & close (cash) | Billed | every non-cancelled job is Done; cash orders skip Finished |
| Finished | Mark as invoiced | Billed | none |
| Finished | Reopen (admin) | In Progress | admin only |

Billed is terminal. A billed order is archived in the same write.

## Archived is a flag, not a status

`orders.is_archived` means "hidden from the default list". It sits beside
the status and never changes it. Three actions set it:

| Action | Where | Allowed while | Effect |
|---|---|---|---|
| Cancel order | order header | Quote, In Progress | every job gets `is_cancelled`, the order is archived, status unchanged, history `CANCELLED` |
| Archive order | order header | Finished | order archived, jobs untouched, history `ORDER_ARCHIVED` |
| Mark as invoiced / Finish & close | lifecycle button | see table above | status Billed and archived, history `ORDER_BILLED` / `ORDER_CLOSED_CASH` |

The header shows **either** Cancel **or** Archive, never both:

- Quote, In Progress: Cancel visible, Archive hidden. Work that has not
  finished can be called off; it cannot be parked.
- Finished: Archive visible, Cancel hidden. Finished work cannot be called
  off any more; it can be put away without invoicing it.
- Billed: neither. The order is already archived.

A quote can also be deleted outright from its sidebar row menu. Nothing else
deletes an order.

Reopen clears the archived flag if the finished order had been archived, so
the reopened order is back in the default list.

## What the sidebar lists

The list is driven by two controls in the sidebar header.

**Status filter** (popover): one checkbox per status, plus "All statuses".
Default: Quote and In Progress ticked. A row is listed only if its status is
ticked. With every box unticked the list is empty. "All statuses" drops the
status condition entirely.

**Show archived** (toggle button): off by default.

- Off: non-archived orders, plus billed ones. Billed orders are always
  archived, so without this exception the Billed checkbox could never list
  anything.
- On: archived orders too. This is the only way to see a cancelled order or
  an archived finished order.

The two combine as AND, together with the search box and the other filters.

| Order | Status filter | Toggle off | Toggle on |
|---|---|---|---|
| Live quote / in progress | ticked (default) | listed | listed |
| Live finished | Finished ticked | listed | listed |
| Billed | Billed ticked | listed | listed |
| Billed | "All statuses" | listed | listed |
| Cancelled (was in progress) | In Progress ticked | hidden | listed |
| Archived finished | Finished ticked | hidden | listed |

A cancelled order carries no marker in the list. Its row looks like a live
order of the same status; the only hints are the missing department icons
(all jobs cancelled) and the `CANCELLED` entry in its history.

## Selection

Cancel, Archive, Mark as invoiced and Finish & close close the details pane
and clear the selection, because the row leaves the default list. A filter
change never clears the selection: if the selected order's row is filtered
out, the details stay open.

## Gaps between this document and the code

- **Header buttons.** Today Cancel and Archive are both shown in every
  non-billed status. Target: Cancel while Quote or In Progress, Archive while
  Finished, neither while Billed.
- **Reopen and the archived flag.** Today Reopen only changes the status; an
  archived finished order stays archived after reopening. Target: Reopen
  clears the flag.
- **Cancelled is invisible.** Cancelled and archived orders are the same
  thing in the database once the flag is set. Making `CANCELLED` an order
  status (as MKS-52 does for jobs) would give it its own filter checkbox and
  badge; open decision.
- **Cancelled jobs and the job-based filters.** The department and assignee
  filters count cancelled jobs, so a cancelled order still matches a
  department whose only job was cancelled. Open decision.
