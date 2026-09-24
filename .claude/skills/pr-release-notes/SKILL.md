---
name: pr-release-notes
description: Write the release notes for a pull request — the PR description, split into user-facing changes (what the shop team notices) and technical changes (everything else). Use when the user opens or prepares a PR, asks to "document this PR", "write the PR description", "release notes for this branch", or when a CI job asks for a PR body. Works on the current branch against main, or on a given PR number.
---

# Release notes for a pull request

Every PR in this repo carries a description that says what it changes, for two
audiences: the shop team that uses the app, and the developers who maintain
it. This skill produces that description from the branch's actual changes,
not from the commit subjects alone.

## Arguments

- **Base** — the branch the PR targets. Default `main`. Compare against
  `origin/main` after a `git fetch origin main`, so the comparison is against
  what is really merged.
- **PR number** (optional) — when given (by the user or by a CI job), the
  result is written into that PR's body. Without it, the result is printed for
  the user to paste or to pass to `gh pr create`.
- **Head** — the current branch unless the user names another.

## Gathering the changes

1. `git fetch origin main` (quietly), then the range `origin/main...HEAD`:
   - `git log --reverse --format='%h %s%n%b' origin/main..HEAD` — the story in
     order.
   - `git diff --stat origin/main...HEAD` — the footprint.
2. Read the diffs of every file that changes behaviour: `src/`, `electron/`,
   `supabase/migrations/`, `supabase/functions/`. Use
   `git diff origin/main...HEAD -- <path>` per file; pipe large outputs
   through `head` or save them to the scratchpad. Do not guess a change's
   effect from its file name.
3. Skim, do not read in full, the files that only support a change: `e2e/`,
   `docs/`, `*.md`, `.github/`, config files, lockfiles. Note what they add
   or remove in one clause each.
4. Collect Jira keys (`MKS-<n>`) from the branch name, commit messages and
   the diff. When the Atlassian tools are available, fetch each issue's
   summary so the notes can say what was asked for, not only what was done.
   In CI they are not available; then the key alone is enough.
5. Note whether `supabase/migrations/` gained files. The database is in
   production, so a migration is always called out (see the template).

If the range is empty, say so and stop; there is nothing to describe.

## Classifying each change

Every distinct change lands in exactly one of the two lists. The test is:
**would someone at the shop notice this while using the app?**

- **User-facing changes** — new features, changed behaviour or workflow
  rules, UI changes, and fixes for things the shop team hit or reported.
  Examples: a job in the OTHER department now moves to pre-press on its own;
  archived orders are hidden behind a toggle; a new order defaults its
  deadline to today.
- **Technical changes** — everything else, as a plain list: internal bug
  fixes, refactors, renamed identifiers, tests and fixtures, CI and workflow
  changes, documentation, lint and type clean-ups, dependency bumps,
  tooling, and the mechanics behind a user-facing change (the migration, the
  removed helper, the new hook).

A change can contribute to both lists in different words: the user-facing
line says what changed for the shop, the technical line says how. Do not
repeat the user-facing wording in the technical list.

When unsure, put it in technical. An empty user-facing section is fine and
says "None" — never pad it with internals dressed up as features.

The user-facing list is copied verbatim into the GitHub release the shop
reads (see `docs/releasing.md`), so it must stand on its own without the
surrounding PR context — no "see above", no assuming the reader has read
other PRs' notes.

## Writing the description

Use exactly this shape. Keep the markers: a rerun (for example from CI
after new commits) replaces only what sits between them and leaves anything
a human wrote outside them.

```markdown
<!-- release-notes:start -->
## Summary

One or two sentences: what this PR is for, and the Jira key(s) it closes.

## User-facing changes

- …

## Technical changes

- …

## Database

Only when `supabase/migrations/` changed. List each new migration file and
what it does in one line, and state whether it touches existing rows. The
database is in production; a reviewer must see this without opening the diff.
Omit the whole section when there is no migration.

## Testing

What was run and passed: typecheck, lint, the e2e spec files, manual checks.
Name spec files, not test counts. Say plainly if something was not run. In
CI, where nothing can be run, point to the checks on the PR instead.
<!-- release-notes:end -->
```

Style, per section:

- **User-facing**: plain language the shop team uses. Lead with what they can
  now do or what now happens. No file names, component names, table names,
  hook names or acronyms they would not use. One line per change; a second
  sentence only when the rule itself needs stating (for example a new gate).
  Match the depth of the work: a large feature reads as a large feature.
- **Technical**: one line per change, terse, concrete. Naming a file,
  function, fixture or migration is welcome here; it is what a reviewer
  greps for. Group by area when the list is long (app, tests, CI, docs).
- **Everything**: English. Present tense ("moves", not "moved"). No commit
  hashes. No "this PR" at the start of every line. Jira keys as plain text
  (`MKS-86`); GitHub links them.

## Delivering

1. Verify the description against the diff once more: every file group in
   `git diff --stat` is accounted for by at least one line, and no line
   describes something the diff does not contain.
2. Then, by situation:
   - **A PR number is known** and `gh` is available: read the current body
     with `gh pr view <n> --json body -q .body`. If it contains the markers,
     replace the block between them; otherwise put the new block first and
     keep the existing body below it. Write the file to the scratchpad and
     apply it with `gh pr edit <n> --body-file <file>`. Report the PR URL.
   - **The user is about to open the PR**: print the description in a fenced
     block and offer `gh pr create --base main --title "<title>" --body-file
     <file>`. Suggest a title of at most 70 characters, imperative mood,
     with the Jira key first when there is one (`MKS-86: promote every
     department to pre-press`).
   - `gh` is not installed: print the description and say so; do not try
     to reach GitHub another way.
3. When Claude itself creates or edits the PR, end the body with the
   attribution line the session requires for pull requests.
