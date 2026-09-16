# Playwright End-to-End Testing

How we write Playwright specs for this project. This guide implements the
[Testing Standards](testing-standards.md) for the e2e suite — those rules
(fixtures files, minimal assertions, setup/assert/cleanup stages) apply
unchanged here, and win if the two ever disagree. For how a run is wired
(config, global setup, workers, teardown) see [`e2e/README.md`](../../e2e/README.md).

This is a living document; expect it to grow as the suite does.

---

## Locator Strategy

**Locate by test ID whenever possible.** Every element a test needs to find
gets a `data-testid` in the component, and the test finds it with
`page.getByTestId(...)`.

**Do not locate by hard-coded text.** A locator such as
`getByRole('heading', { name: 'Welcome back' })` couples the suite to copy.
If the copy changes, the test fails — and we don't care about that copy; the
test wasn't about it. This is the same failure the Testing Standards call
out for assertions on exact messages, applied to finding elements. It is
worst when the same text is typed in several places, because then a copy
change breaks several tests at once, for no behavioural reason.

Text is acceptable in a locator only when the text **is** the behaviour under
test — e.g. checking that a freshly created job displays its job number. Even
then the value comes from a fixture, never a literal typed into the spec.

Where a `data-testid` cannot be placed directly (a third-party-rendered
element), scope a role-based locator inside a test-ID'd container:
`dialog.root.getByRole('option')`.

---

## The Test ID Registry

All test IDs are declared **once**, in a single support file, and imported
from there by both sides:

- **Components** import it to set the attribute:
  `<Input data-testid={TEST_IDS.login.email} />`
- **Page objects** import it to build the locator:
  `page.getByTestId(TEST_IDS.login.email)`

No test ID string is ever typed anywhere else. If the app and the suite refer
to the same constant, they cannot drift apart, and renaming an ID is a
one-line change.

Conventions:

- File: `e2e/support/testIds.ts`, exporting one `TEST_IDS` object, `as const`.
- **Pure constants only** — no Playwright, Node or React imports. The app
  bundles this file, so it must stay free of anything the renderer cannot
  load.
- Nested by page, then by section/component, mirroring the page object
  structure: `TEST_IDS.orders.sidebar.searchInput`,
  `TEST_IDS.orders.newOrderDialog.customerInput`.
- Values are kebab-case and prefixed by their path so they are unique in
  the DOM: `'orders-sidebar-search-input'`.
- For repeated elements (a row per order, a row per job) the ID marks the
  row *kind*; the test picks the instance by scoping or by a data attribute
  the row carries — not by a text match.

---

## Page Object Model

Locators live in **page object classes**, not in specs. A spec imports the
page object for the view it exercises and reaches every locator through it,
including those of nested components.

### Files and naming

- Folder: `e2e/pom/`.
- One class per file; class and file share a name suffixed with `POM`:
  `OrdersPOM.ts` exports `class OrdersPOM`.
- Top-level page objects, one per view: the orders workspace, the stamp and
  textile stock pages, the user menu, the user management page.

### Modularity — child page objects

A view with complex parts is **composed**, not written as one large class.
Every dialog, panel or other self-contained element gets its own `POM` class,
and the parent exposes it as a property:

```ts
// e2e/pom/NewOrderDialogPOM.ts
export class NewOrderDialogPOM {
  readonly root: Locator
  readonly customerInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(TEST_IDS.orders.newOrderDialog.root)
    this.customerInput = this.root.getByTestId(TEST_IDS.orders.newOrderDialog.customerInput)
    this.submitButton = this.root.getByTestId(TEST_IDS.orders.newOrderDialog.submitButton)
  }
}

// e2e/pom/OrdersPOM.ts
export class OrdersPOM {
  readonly newOrderButton: Locator
  readonly newOrderDialog: NewOrderDialogPOM

  constructor(page: Page) {
    this.newOrderButton = page.getByTestId(TEST_IDS.orders.sidebar.newOrderButton)
    this.newOrderDialog = new NewOrderDialogPOM(page)
  }
}
```

From a spec the whole tree is one import away:

```ts
const orders = new OrdersPOM(page)
await orders.newOrderButton.click()
await orders.newOrderDialog.customerInput.fill(fixtures.customer.name)
```

Rules of thumb:

- A child page object owns everything inside its `root`; the parent never
  reaches into a child's internals.
- Child locators are scoped to the child's `root` so an ID that appears in
  two dialogs can't resolve to the wrong one.
- If a class stops being easy to scan, split a section out into a child.
  There is no fixed size limit — the goal is that no single class is
  complex.

### What goes in a page object

- **Locators** — the reason the class exists.
- **Short interaction helpers** when a user-level action spans several
  steps and is used by more than one spec (e.g. `signIn(user)` fills two
  fields and clicks). They describe *what a user does*, not what the test
  expects.
- **Never assertions.** `expect` stays in the spec, where the Testing
  Standards' minimal-assertion rule governs it. A page object that asserts
  hides what a test is actually checking.
- **Never test data.** Values come from `e2e/fixtures/*`; the page object
  receives them as arguments.

---

## Putting It Together

```ts
import { expect, test } from './fixtures/auth'
import { OrdersPOM } from './pom/OrdersPOM'
import { orderFixtures } from './fixtures/orders'

test('creates a quote for an existing customer', async ({ page }) => {
  // Setup
  const orders = new OrdersPOM(page)
  await orders.newOrderButton.click()
  await orders.newOrderDialog.customerInput.fill(orderFixtures.customer.name)

  // Assert
  await orders.newOrderDialog.submitButton.click()
  await expect(orders.details.statusBadge).toBeVisible()

  // Cleanup
  ...
})
```

The spec names no test ID, no visible text and no selector — only page
object members and fixture values.

---

## Anti-Patterns

| Anti-pattern | Why | Instead |
|---|---|---|
| Locating by visible text (`getByText`, `getByRole` with `name`) | Breaks on copy changes that have nothing to do with behaviour | `data-testid` + `getByTestId` through a page object |
| Typing a test ID string in a component or spec | Duplicates the registry; app and suite drift apart | Import `TEST_IDS` on both sides |
| `page.getByTestId(...)` inside a spec | Puts locator knowledge in the test; every spec re-learns the page | Add the locator to the page object |
| One page object class for an entire view | Grows unreadable; every change touches it | Child `POM` classes per dialog/panel, composed by the parent |
| `expect` inside a page object | Hides what the test asserts; violates minimal assertions | Return locators; assert in the spec |
| Test data as defaults inside a page object | Same data problem the Testing Standards forbid in specs | Pass fixture values in |
