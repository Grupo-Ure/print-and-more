# Releasing

## Principles

Every change reaches `main` through a PR, and the PR's **User-facing
changes** section is the shop's release text — it goes straight into the
draft release, unedited, so check its wording before merging (see
[`pr-release-notes`](../.claude/skills/pr-release-notes/SKILL.md)).

Tags are immutable: never move, delete or re-push one. A botched release is
fixed by the next patch version, not by rewriting history. Exactly one
published release exists per tag.

## Standard release, step by step

1. On `main`, in sync with `origin` (`git pull`).
2. Bump `version` in `package.json`.
3. Commit: `chore: release v<version>`.
4. Push `main`.
5. `npm run release:tag` — tags the commit and pushes the tag. Refuses if
   you're not on `main`, `main` isn't in sync with `origin/main`, or the tag
   already exists.
6. Wait for CI: the `checks` job runs, then `release` builds the Windows
   installer, publishes it to a **draft** GitHub release, and fills the
   draft's body from the user-facing sections of the PRs merged since the
   previous tag.
7. Open the draft on GitHub: read the notes, fix wording if needed, confirm
   the installer assets are attached.
8. Click **Publish release**.
9. Delete any other draft release left over for the same tag (see "Orphan
   drafts" below).
10. Optionally, confirm one machine picks up the update through the
    auto-updater.

## Off-script cases

**The release job failed after the tag was pushed.** The tag stays — never
delete or move it. Fix the problem via a normal PR, bump the patch version,
and tag again with the new version. Delete the dead draft release the failed
run may have created.

**The notes are wrong or incomplete.** Edit the draft release body by hand
on GitHub before publishing — the draft is the place to fix wording, not the
PRs it was assembled from.

**Something reached `main` without a PR.** `release-notes.mjs` lists it
under **Other changes** by commit subject, so nothing is silently dropped.
Rewrite or delete that line by hand before publishing, and avoid direct
pushes to `main` going forward.

**A hotfix is needed.** Still goes through a PR, then a normal patch
release — there is no separate hotfix path.

**A release was published with wrong notes.** Edit the published release
body directly; the auto-updater only reads the installer's own metadata,
never the release notes, so editing a published release is safe at any time.

**Orphan drafts.** Every version tends to leave one extra draft release next
to the one that gets published — delete the leftovers once you've published
the real one, so they don't get mistaken for the current release later.

**The tag script (`npm run release:tag`) refuses.** It's one of three
guards: not on `main` (check out `main` and merge the bump there first),
`main` out of sync with `origin/main` (pull or push), or the tag already
exists (bump the version before tagging again).

**A tag was pushed from a feature branch out of old habit.** Don't move or
delete it — a tag is immutable. Merge the branch, bump the patch version,
and tag `main` for the corrected release.

## Where the pieces live

- `.github/workflows/ci.yml` — the `release` job: builds the installer,
  publishes the draft, then runs `scripts/release-notes.mjs`.
- `scripts/tag-release.mjs` — tags and pushes (`npm run release:tag`);
  enforces the merge-then-tag-on-main order.
- `scripts/release-notes.mjs` — assembles and writes the draft release body
  (`npm run release:notes -- --tag v1.9.0 --dry-run` to preview locally).
- `.github/workflows/pr-release-notes.yml` +
  [`.claude/skills/pr-release-notes/SKILL.md`](../.claude/skills/pr-release-notes/SKILL.md)
  — writes each PR's description, the source material for the release body.
- `electron-builder.yml`, `publish` block — the repo (`Grupo-Ure/print-and-more`)
  the app updates from; `arbeitsdenkmal/Auftragssystem` is a mirror only.
