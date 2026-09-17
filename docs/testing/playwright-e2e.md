# Playwright End-to-End Testing

How we write Playwright specs for this project. This guide implements the
[Testing Standards](testing-standards.md) for the e2e suite — those rules
(fixtures files, minimal assertions, setup/act/assert/cleanup stages) apply
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
- **Every page object extends `BasePOM`** (`e2e/pom/BasePOM.ts`). It holds
  the `page` and the locator helpers every page object shares — e.g.
  `withAttr(locator, attr, value)`, which narrows a repeated element to one
  instance. Shared helpers live there and nowhere else; a page object never
  imports helpers from outside the class hierarchy.
- Top-level page objects, one per view: the orders workspace, the stamp and
  textile stock pages, the user menu, the user management page.

### Modularity — child page objects

A view with complex parts is **composed**, not written as one large class.
Every dialog, panel or other self-contained element gets its own `POM` class,
and the parent exposes it as a property:

```ts
// e2e/pom/NewOrderDialogPOM.ts
export class NewOrderDialogPOM extends BasePOM {
  readonly root: Locator
  readonly customerInput: Locator
  readonly customerOptions: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(TEST_IDS.orders.newOrderDialog.root)
    this.customerInput = this.root.getByTestId(TEST_IDS.orders.newOrderDialog.customerInput)
    this.customerOptions = this.root.getByTestId(TEST_IDS.orders.newOrderDialog.customerOption)
    this.submitButton = this.root.getByTestId(TEST_IDS.orders.newOrderDialog.submitButton)
  }

  /** One of the repeated result rows, picked by its `data-customer-id`. */
  customerOption(customerId: string): Locator {
    return this.withAttr(this.customerOptions, 'data-customer-id', customerId)
  }
}

// e2e/pom/OrdersPOM.ts
export class OrdersPOM extends BasePOM {
  readonly newOrderButton: Locator
  readonly newOrderDialog: NewOrderDialogPOM

  constructor(page: Page) {
    super(page)
    this.newOrderButton = page.getByTestId(TEST_IDS.orders.sidebar.newOrderButton)
    this.newOrderDialog = new NewOrderDialogPOM(page)
  }
}
```

### Page objects arrive as fixtures

A spec never constructs a page object. Each top-level page object is
provided by a Playwright fixture in the fixture file for its layer —
`login` and `navbar` in `fixtures/auth.ts`, `ordersPage` in
`fixtures/orders.ts` — and the spec takes it from its arguments. The whole
tree is then reachable from that one argument:

```ts
test('creating an order for an existing customer opens it as a quote', async ({ ordersPage, customer }) => {
  await ordersPage.sidebar.newOrderButton.click()
  await ordersPage.newOrderDialog.customerSearch.fill(customer.name)
})
```

A new top-level page object gets a fixture in the lowest fixture file that
can provide it (see the fixture chain in [`e2e/README.md`](../../e2e/README.md)).
Child page objects are never fixtures; the parent composes them.

### Fixtures seed, specs navigate

A data fixture (`customer`, `order`, `job`) inserts its rows through the
runner's database connection and reloads the app so it can see them. That
is all it does. It never clicks: opening the order in the sidebar, selecting
the job, opening a dialog — every step to the screen under test is part of
the spec's Act stage, where a failure on the way is reported as what it is.
The only fixture that drives the UI is the auth state in `fixtures/auth.ts`,
because every test needs it in exactly the same way; the login spec covers
those steps itself.

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

### `expect` is for specs only

This applies to fixtures as much as to page objects: **no `expect` outside a
spec file.** An `expect` in support code can fail a test on its own, and the
report then blames an assertion when the real problem was setup.

When support code has to wait for the app to reach a state, use Playwright's
waiting API on a locator that only matches in that state:

```ts
// Good — a wait; a timeout reads as a setup failure
await userMenu.signedInAs(user.email).waitFor()
await login.root.or(userMenu.trigger).waitFor()

// Bad — an assertion in a fixture
await expect(userMenu.trigger).toHaveAttribute('data-user-email', user.email)
```

`waitFor()` retries and times out exactly like a web-first `expect`, so
nothing is lost — only the wrong label.
- **Never test data.** Values come from `e2e/fixtures/*`; the page object
  receives them as arguments.

## Asserting Over Repeated Elements

The Testing Standards forbid assertions inside loops. In Playwright that
rule meets one more constraint: assertions must stay **web-first** (they
retry until they hold or time out), so the collection has to be gathered in
a way that retries too.

- **Prefer a list-aware matcher on the repeated locator** when one fits:
  `toHaveCount(n)` for how many there are; `toHaveText([...])` for what they
  say, but only where the text is the behaviour under test.
- **Otherwise read the values through the page object and assert with
  `expect.poll`.** The page object exposes a read helper that returns what
  the repeated elements carry — usually their data attributes. The spec
  wraps the call in `expect.poll`, which re-runs the whole read until the
  assertion holds or times out, exactly like a web-first `expect`. Compare
  as a `Set` when order is not the point.

```ts
// e2e/pom/NavbarPOM.ts
/** The views that currently have a navbar link. */
async renderedViews(): Promise<NavbarView[]> {
  return this.links.evaluateAll(els => els.map(el => el.getAttribute('data-view') as NavbarView))
}

// spec — exactly the role's views, no more, no less
await expect.poll(async () => new Set(await navbar.renderedViews())).toEqual(allowed)
```

The helper is a read, not an assertion, so it belongs in the page object. A
plain `expect(await navbar.renderedViews())` would read once and never
retry — anything that depends on rendering goes through `expect.poll`.

---

## Spec Files — Page, then Feature

Specs live in `e2e/<page>/<feature>/`, never at the `e2e/` root. The page
folder carries a `-page` suffix so a page and a feature of the same name
stay apart (`orders-page/` is the page, `orders-page/order/` the order
feature on it). A feature with a sub-feature of its own gets a nested
folder (`orders-page/job/status/`). Playwright groups by file path, so
every level is a group in every report, and any path fragment filters a
run (`npx playwright test orders-page`, `npx playwright test job/status`).
The support folders stay at the root, and a spec reaches them with as many
`../` as it is deep. The concrete tree is in [`e2e/README.md`](../../e2e/README.md).

---

## Putting It Together

```ts
// e2e/orders-page/new-order.spec.ts
import { expect, test, NEW_ORDER_STATUS } from '../fixtures/orders'

test('creating an order for an existing customer opens it as a quote', async ({ ordersPage, customer }) => {
  // Setup — the `customer` fixture inserted the row and removes it (with its orders) afterwards.
  const dialog = ordersPage.newOrderDialog

  // Act — open the new-order dialog and create the order for that customer.
  await ordersPage.sidebar.newOrderButton.click()
  await dialog.customerSearch.fill(customer.name)
  await dialog.customerOption(customer.id).click()
  await dialog.submit.click()

  // Assert — the created order opens as a quote.
  await expect(ordersPage.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
})
```

The spec names no test ID, no visible text and no selector — only page
object members and fixture values — and it constructs nothing: the page
object and the data both come from the fixture arguments. Every locator
interaction sits in the Act stage; Setup holds only data and page-object
references, and Assert holds only `expect` calls.

---

## Anti-Patterns

| Anti-pattern | Why | Instead |
|---|---|---|
| Locating by visible text (`getByText`, `getByRole` with `name`) | Breaks on copy changes that have nothing to do with behaviour | `data-testid` + `getByTestId` through a page object |
| Typing a test ID string in a component or spec | Duplicates the registry; app and suite drift apart | Import `TEST_IDS` on both sides |
| `page.getByTestId(...)` inside a spec | Puts locator knowledge in the test; every spec re-learns the page | Add the locator to the page object |
| `new SomePOM(page)` inside a spec | Every spec repeats the wiring; the spec depends on `page` only to build it | Take the page object from the fixture arguments (`ordersPage`, `navbar`, `login`) |
| One page object class for an entire view | Grows unreadable; every change touches it | Child `POM` classes per dialog/panel, composed by the parent |
| `expect` inside a `for` over views, rows or other repeated elements | Stops at the first failure; zero iterations pass silently; the list of what is on screen never appears in the report | A list-aware matcher on the repeated locator, or a page-object read helper + `expect.poll` |
| `expect` inside a page object or fixture | Hides what the test asserts; a failure is reported as an assertion instead of a setup problem | Return locators; wait with `waitFor()`; assert in the spec |
| Test data as defaults inside a page object | Same data problem the Testing Standards forbid in specs | Pass fixture values in |
