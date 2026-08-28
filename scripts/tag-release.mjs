// Tags the current commit as v<package.json version> and pushes the tag.
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

console.log(`Tagging and pushing ${tag} …`)
run(`git tag ${tag}`)
run(`git push origin ${tag}`)
console.log(`${tag} pushed — the release pipeline is now running (see the Actions tab).`)
