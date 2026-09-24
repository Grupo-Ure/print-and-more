// Tags the current commit as v<package.json version> and pushes the tag.
// Requires: the version bump is committed on main, in sync with origin —
// releases follow docs/releasing.md (merge first, then bump and tag on main).
// Usage: npm run release:tag
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))
const tag = `v${version}`

const run = cmd => execSync(cmd, { stdio: 'inherit' })
const capture = cmd => execSync(cmd, { encoding: 'utf8' }).trim()

// The tag must point at a commit that CONTAINS the version bump — a dirty or
// staged package.json means the bump isn't committed yet and CI's guard would
// reject the tag.
if (capture('git status --porcelain -- package.json') !== '') {
  console.error('package.json has uncommitted changes — commit the version bump first.')
  process.exit(1)
}

// Tags are only ever cut from main, after the bump has merged — a tag on a
// feature branch attributes PRs to the wrong release (see docs/releasing.md).
const branch = capture('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main') {
  console.error(`On branch "${branch}" — check out main and merge the version bump there first.`)
  process.exit(1)
}

run('git fetch origin main')
const head = capture('git rev-parse HEAD')
const originMain = capture('git rev-parse origin/main')
if (head !== originMain) {
  console.error('main is not in sync with origin/main — pull or push before tagging.')
  process.exit(1)
}

const tagExists = capture(`git ls-remote --tags origin ${tag}`) !== '' || capture(`git tag --list ${tag}`) !== ''
if (tagExists) {
  console.error(`${tag} already exists — bump the version before tagging again.`)
  process.exit(1)
}

console.log(`Tagging and pushing ${tag} …`)
run(`git tag ${tag}`)
run(`git push origin ${tag}`)
console.log(`${tag} pushed — the release pipeline is now running (see the Actions tab).`)
