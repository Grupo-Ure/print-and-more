// Assembles a version's draft GitHub release body from the user-facing
// sections of the PRs it ships, and PATCHes it onto the tag's draft release.
//
// The notes cover the version's whole feature line, not just the step from
// the previous tag: a minor version (1.10) introduces a set of features and
// its patches (1.10.1, 1.10.2, …) add fixes on top, so every 1.10.x body
// lists everything since the last 1.9.x tag. The newest release of a line
// therefore always carries the full story, which is what the in-app release
// notes page shows per line — and a patch that was never published loses
// nothing, since the next one repeats it.
// Usage: node scripts/release-notes.mjs [--tag v1.9.0] [--repo owner/name] [--dry-run]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const dryRun = args.includes('--dry-run')

// Argument arrays, never a command string: the release job runs on Windows,
// where a string would go through cmd.exe and lose its single quotes.
const run = (file, cmdArgs) => execFileSync(file, cmdArgs, { stdio: 'inherit' })
const capture = (file, cmdArgs) => execFileSync(file, cmdArgs, { encoding: 'utf8' }).trim()

const tag = flag('tag') || process.env.GITHUB_REF_NAME
if (!tag) {
  console.error('No tag given — pass --tag v1.9.0 or run from a tag push (GITHUB_REF_NAME).')
  process.exit(1)
}
const version = tag.replace(/^v/, '')
/** "1.10.3" → "1.10": the feature line a version belongs to. */
const featureLine = v => v.replace(/^v/, '').split('.').slice(0, 2).join('.')
const line = featureLine(tag)

let repo = flag('repo') || process.env.GITHUB_REPOSITORY
if (!repo) {
  const originUrl = capture('git', ['remote', 'get-url', 'origin'])
  const match = originUrl.match(/[:/]([^/]+\/[^/]+?)(\.git)?$/)
  if (!match) {
    console.error(`Could not derive owner/repo from origin remote: ${originUrl}`)
    process.exit(1)
  }
  repo = match[1]
}

// 1. Window: from the newest tag of an older feature line (for v1.10.3, the
// newest v1.9.x) up to TAG — so the earlier patches of TAG's own line fall
// inside it. No older line → the first release, everything up to TAG.
const allTags = capture('git', ['tag', '--list', 'v*', '--sort=-v:refname']).split('\n').filter(Boolean)
const tagIndex = allTags.indexOf(tag)
if (tagIndex === -1) {
  console.error(`Tag ${tag} not found locally — fetch it first (git fetch --tags).`)
  process.exit(1)
}
const prevTag = allTags.slice(tagIndex + 1).find(t => featureLine(t) !== line)
console.log(prevTag ? `Window: ${prevTag}..${tag} (feature line ${line})` : `Window: first release, up to ${tag}`)

// 2. PRs merged in the window, matched by merge-commit ancestry against TAG
// (and, with a previous tag, excluded when already an ancestor of it) —
// this is correct whether the tag was cut on main after the merge or, as
// happened once, on the feature branch before it.
const searchFrom = prevTag ? `merged:>=${capture('git', ['log', '-1', '--format=%aI', prevTag])}` : ''
const prListJson = capture('gh', [
  'pr', 'list', '-R', repo, '--state', 'merged', '--base', 'main',
  ...(searchFrom ? ['--search', searchFrom] : []),
  '--limit', '100', '--json', 'number,title,body,mergeCommit,mergedAt',
])
const candidatePrs = JSON.parse(prListJson)

const isAncestor = (sha, ref) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, ref], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const prs = candidatePrs
  .filter(pr => pr.mergeCommit?.oid)
  .filter(pr => isAncestor(pr.mergeCommit.oid, tag))
  .filter(pr => !prevTag || !isAncestor(pr.mergeCommit.oid, prevTag))
  .sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt))

// 3. Extract the "User-facing changes" section from each PR body.
const START = '<!-- release-notes:start -->'
const END = '<!-- release-notes:end -->'
const extractUserFacing = body => {
  const startIdx = body.indexOf(START)
  const endIdx = body.indexOf(END)
  if (startIdx === -1 || endIdx === -1) return null
  const block = body.slice(startIdx + START.length, endIdx)
  const headingIdx = block.indexOf('## User-facing changes')
  if (headingIdx === -1) return null
  const afterHeading = block.slice(headingIdx + '## User-facing changes'.length)
  const nextHeadingIdx = afterHeading.search(/\n##\s/)
  const section = (nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx)).trim()
  if (section === '' || section === 'None') return null
  return section
}

const prNotes = []
for (const pr of prs) {
  const section = extractUserFacing(pr.body || '')
  if (section === null) {
    console.log(`PR #${pr.number}: no user-facing changes — skipped.`)
    continue
  }
  prNotes.push({ number: pr.number, section })
}

// 4. Commits that reached main outside a tracked PR's merge commit and
// outside the version-bump commit — listed so nothing shipped is silently
// dropped.
const bumpPattern = /^chore: release v[\d.]+$/
const prMergeShas = new Set(prs.map(pr => pr.mergeCommit.oid))
const revListRange = prevTag ? `${prevTag}..${tag}` : tag
const directCommitsLog = capture('git', ['log', '--first-parent', '--no-merges', '--format=%H%x09%s', revListRange])
const directCommits = directCommitsLog
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [sha, subject] = line.split('\t')
    return { sha, subject }
  })
  .filter(({ sha, subject }) => !prMergeShas.has(sha) && !bumpPattern.test(subject))

// 5. Compose the body.
let body = `## What's new in ${line}\n\n`
if (prNotes.length === 0) {
  body += `No user-facing changes in ${line} yet.\n`
} else {
  body += prNotes.map(({ section }) => section).join('\n') + '\n'
}
if (directCommits.length > 0) {
  body += '\n## Other changes\n\n'
  body += directCommits.map(({ sha, subject }) => `- ${subject} (${sha.slice(0, 7)})`).join('\n') + '\n'
}
if (prNotes.length > 0) {
  body += `\n*Assembled from pull request${prNotes.length > 1 ? 's' : ''} ${prNotes.map(n => `#${n.number}`).join(', ')}.*\n`
}

if (dryRun) {
  console.log('\n--- dry run: release body ---\n')
  console.log(body)
}

// 6. Find the draft release for this tag and write the body.
const releasesJson = capture('gh', ['api', `repos/${repo}/releases`, '--paginate'])
const releases = JSON.parse(releasesJson).filter(r => r.tag_name === tag)
const published = releases.find(r => !r.draft)
if (published) {
  console.error(`${tag} is already published; bump the version instead of re-releasing this tag.`)
  process.exit(1)
}
const drafts = releases.filter(r => r.draft)
if (drafts.length === 0) {
  console.error(`No draft release found for ${tag} — has the build step created one yet?`)
  process.exit(1)
}
// The CI job creates exactly one draft before electron-builder uploads, so a
// second one means the uploads split across drafts again; guessing which one
// is real is how the notes once landed on a blockmap-only draft.
if (drafts.length > 1) {
  console.error(
    `${drafts.length} draft releases exist for ${tag} (ids ${drafts.map(d => d.id).join(', ')}). ` +
      'Keep the one with the Setup installer, delete the others, then rerun.',
  )
  process.exit(1)
}
const draft = drafts[0]
const installer = `-Setup-${version}.exe`
if (!draft.assets.some(asset => asset.name.endsWith(installer))) {
  console.error(`The draft release for ${tag} (id ${draft.id}) has no *${installer} asset — the build did not upload into it.`)
  process.exit(1)
}

if (dryRun) {
  console.log(`\nWould PATCH release id ${draft.id} for ${tag}. Stopping (--dry-run).`)
  process.exit(0)
}

const payloadPath = join(tmpdir(), `release-notes-${tag}.json`)
// tag_name must travel with every update: a PATCH to a draft without it
// detaches the draft from its tag (GitHub renames it `untagged-<hash>`), and
// publishing that draft then creates a junk tag instead of using this one.
writeFileSync(payloadPath, JSON.stringify({ tag_name: tag, body }))
run('gh', ['api', '-X', 'PATCH', `repos/${repo}/releases/${draft.id}`, '--input', payloadPath])
console.log(`Updated the draft release body for ${tag} (id ${draft.id}).`)
