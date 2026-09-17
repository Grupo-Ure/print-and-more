# Testing Standards

This document defines **how we write tests**, independent of language, test
runner, or framework. It applies to unit, integration, and end-to-end tests
alike. Technology-specific guides (e.g. a guide for a particular framework)
implement these standards — they don't replace them. If a technology-specific
guide conflicts with this one, this one wins.

This is a living document. Expect it to be refined as our test suites grow
and we learn what needs to be stricter or looser.

---

## Core Principles

1. **No mock data inline in test files.** All test data — objects, strings,
   numbers, dates, anything used as input or compared against — is declared
   in a dedicated fixtures/mocks file and imported.
2. **Assert as little as possible.** Assert only what proves the behavior
   under test. Prefer shape/type/status over exact values; prefer exact
   values only when the value itself is the point of the test.
3. **Prefer black-box testing.** Test inputs and outputs, not internal
   implementation details, whenever the type of test allows it.
4. **Every test case has four stages** — setup, act, assert, cleanup —
   marked with comments, with cleanup used only when needed.
5. **Short and elegant over exhaustive.** A test suite should be quick to
   read and understand. Testing the minimum that proves correctness beats
   testing everything that's possible to test.

---

## Fixtures and Mocks

Test data and fake implementations never live in the test file itself. They
live in their own file(s), imported by the test.

### Fixtures vs. mocks

- **Fixtures** — data: sample entities, payloads, strings, IDs, dates —
  anything a test uses as input or expected output.
- **Mocks** — fake behavior: stand-ins for dependencies (a fake service,
  a fake client, a stubbed function) that the code under test calls.

Both rules below apply to each equally: they get their own file(s), and
nothing that qualifies as either is ever declared inline in a test file.

### One file, or several

Start with a single fixtures file and a single mocks file per suite (or per
package, if the suite is small). As a suite grows, split by module or by
type of test (e.g. one fixtures file per feature area) rather than letting
one file become unmanageable. There's no fixed threshold — split when a file
stops being easy to scan.

### Data vs. generator

A fixture entry can be a plain object/constant, or a function that returns
one:

- Use a **plain value** for anything static — a name, an ID, a status, a
  sample payload.
- Use a **function** when the value must be produced at call time — a
  current date/timestamp, a random value, a fresh unique ID, or an object
  that needs per-call overrides (e.g. a factory that returns a base object
  merged with caller-supplied overrides).

Nothing that could reasonably be a shared constant gets typed out by hand in
a test again — if a second test needs "the same string," it imports the same
fixture, it doesn't retype the string.

### Single source of truth — the recurring mistake to avoid

A common failure mode: a hardcoded string is declared once to build the
input, then the *same string is hardcoded again* in the assertion. This
silently defeats the test — if the value drifts, setup and assertion drift
together and the test keeps passing.

```
// Bad — the literal is typed twice; a typo or a rename in one
// place and not the other and the test still tells you nothing
const input = { status: "active" }
...
expect(result.status).toBe("active")

// Good — one declaration, imported everywhere it's needed
const input = { status: fixtures.activeStatus }
...
expect(result.status).toBe(fixtures.activeStatus)
```

If a value is used more than once anywhere in a test (setup or assertion),
it comes from the fixture file, referenced by name, not retyped.

---

## Assertions

### Assert the minimum that proves the behavior

Before writing an assertion, ask: what is the smallest thing I could check
that would fail if — and only if — this behavior is broken? Resist the urge
to assert everything you happen to have access to.

### Prefer shape over value

When the exact value isn't the point of the test, assert its shape or type,
not its content. Example: testing an error path usually needs to prove
*that it failed and how it was categorized* (a status code, an error type,
an error code) — not the human-readable message, which is free to change.

```
// Bad — breaks the moment the message copy changes, and the copy
// change has nothing to do with whether the feature still works
expect(error.message).toBe("Cannot delete an order that has shipped")

// Good — the thing that matters (that it was rejected, and why-category)
// is what's asserted
expect(error.code).toBe(fixtures.errorCodes.invalidState)
```

### When exact values matter, assert them

This isn't a blanket ban on exact-value assertions. When a specific value
*is* the behavior under test — e.g. a flag flips from `false` to `true` as
the direct result of the action being tested — assert that value exactly.
The rule is to be deliberate: assert precisely what's semantically
meaningful to the case, and nothing that's incidental to it.

### Never assert inside a loop

An assertion never lives in a loop body — not in a `for`, a `forEach`, a
`map`, or any other iteration. Two things go wrong when it does: the run
stops at the first failing iteration and hides whether the others would have
failed too, and a loop that happens to iterate zero times asserts nothing
while the test still passes.

Instead, gather what the loop would have checked into one value and make one
assertion against one fixture value. Use the framework's collection matchers
where they exist (a count, an "equals this list/set", an "every item
matches"). Where the framework has no such matcher, collect the values
yourself — an array, a set, a map keyed by the thing you iterated — and
compare the whole structure. The test then reads as one scenario with one
reason to fail, and the failure message shows the complete difference at
once.

```
// Bad — stops at the first mismatch; passes silently if `items` is empty
for (const item of items) {
  expect(item.status).toBe(fixtures.doneStatus)
}

// Good — one assertion, whole picture on failure
expect(items.map(item => item.status)).toEqual(fixtures.allDoneStatuses)
```

Generating *test cases* in a loop — one case per entry of a fixture table —
is a different thing and is fine: each generated case still contains its own
straight-line assertions.

---

## Black-Box Testing

Wherever the kind of test allows it, test through the public
interface — inputs in, outputs out — not internal state or private
implementation details. Don't assert that a specific internal helper was
called a specific way unless that call *is* an externally-observed contract
(e.g. it's the mechanism by which a side effect the test cares about
happens). Internals are free to be refactored; a black-box test doesn't
notice and doesn't need to change.

This is a guideline, not an absolute — some test types (e.g. testing that a
dependency was invoked with the right arguments, where that call is the
entire observable effect) legitimately need to look at an interaction rather
than a return value. Use judgment, but default to the outside view.

---

## Test Case Structure

Every test case is written in four stages, each marked with a comment, in
this order:

1. **Setup** — prepare all the data the test is going to need: build the
   input, instantiate mock data, establish any preconditions. Values come
   from the fixtures/mocks files, not inline literals. Nothing in this stage
   exercises the behavior under test.
2. **Act** — perform the action being tested. In a UI test this is where the
   locators are used to trigger actions in the interface — *every* click,
   including the ones that get to the screen under test (opening the record,
   selecting the row). Getting where you need to be in the app is part of
   the test, not of a fixture. In a unit test it is the call to the function
   under test. No assertions here.
3. **Assert** — check the outcome. Keep this to the minimal set of
   assertions that proves the behavior (see above). No further actions here
   — if an assertion needs another action first, that action belongs in
   the Act stage.
4. **Cleanup** — undo anything the test created or changed that would
   otherwise leak into other tests (e.g. a record written to a shared
   store). Most test cases don't need this stage — recognize when a test
   does (anything with a side effect outside the test's own scope) and
   include it only then.

```
it("<describes the behavior in plain terms>", () => {
  // Setup
  ...

  // Act
  ...

  // Assert
  ...

  // Cleanup
  ...
})
```

**Fixtures prepare data, not state in the interface.** A fixture inserts,
generates or removes data; it never drives the UI to a place. A fixture that
navigated would assume every step on the way works, and two such fixtures in
one test would fight over what is on screen. The one exception is the
prerequisite *every* test shares and performs identically — in this app,
being signed in — which lives in one fixture. The test that covers that
prerequisite itself (the login test) spells the steps out instead of using
the fixture.

**A stage with no code does not exist.** Omit its comment entirely — don't
leave a comment with an empty line below it as a placeholder. This applies
to every stage, not just Cleanup: a test whose data all comes from fixtures
has no Setup stage, and a test that only observes a state a fixture already
produced has no Act stage. If it helps the reader, mention what the fixture
did in the comment of a stage that does exist.

---

## Test Suite Shape

The goal is a suite that's fast to read and easy to trust, not one that
maximizes assertion count or case count.

- Prefer a small number of well-chosen cases over exhaustively enumerating
  every input combination.
- Each test case should read as one clear scenario with one clear reason to
  fail. If a case is asserting several unrelated things, it's probably
  covering more than one scenario and should be split — or trimmed.
- If two test cases only differ by a value that doesn't change the code
  path being exercised, that's a sign one of them isn't adding coverage.
- A long, sprawling test file is itself a problem to fix, not a sign of
  thoroughness — split it, or cut cases that aren't pulling weight.

---

## Anti-Patterns

| Anti-pattern | Why | Instead |
|---|---|---|
| Declaring mock/fixture data inline in a test file | Duplicates data, invisible to other tests that need the same value, breaks silently when it drifts | Declare it once in the fixtures/mocks file and import it |
| Hardcoding the same literal in both setup and assertion | The assertion can silently stop testing anything if the two drift apart | Reference the same fixture constant in both places |
| Asserting an exact error message | Brittle — breaks on copy changes unrelated to behavior | Assert a status/code/category |
| An assertion inside a loop body | Stops at the first failing iteration and hides the rest; zero iterations pass silently | Collect the values and make one assertion against the whole collection |
| Asserting every field of a result with exact values | Over-specified, couples the test to incidental detail | Assert only the fields that are semantically meaningful to the case |
| Testing internal implementation details | Breaks on refactors that don't change behavior | Test the public input/output contract |
| One test case asserting many unrelated behaviors | Failure doesn't say what broke; hard to read | Split into focused cases, one reason to fail each |
| Skipping cleanup for a test with an external side effect | Leaks state into other tests, causes flaky failures | Add a Cleanup stage that undoes it |
| A stage comment with no code under it (an empty Setup, Act or Cleanup) | Noise, makes the suite harder to scan | Omit the stage entirely when it has nothing in it |
