// The e2e test plan (e2e/TEST_PLAN.md) is the source of truth for what the
// suite tests; this script holds the specs to it.
//
//   node scripts/test-plan.mjs check    the specs match the plan — fails on a
//                                       test the plan does not name (CI)
//   node scripts/test-plan.mjs status   what the plan still wants written
//   node scripts/test-plan.mjs assign   number the plan's unnumbered tests
//
// The plan is a hand-written tree: a pack bullet links a spec file and names
// its ID prefix, an italic bullet is a `describe` block (the precondition),
// and a test bullet is `**<PREFIX>-<NNN>** <title>` — or just `<title>` until
// `assign` numbers it. A spec test's title is `<ID> <title>`, inside the same
// describe chain the plan puts it under. Nothing here edits a spec.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const PLAN = 'e2e/TEST_PLAN.md'
const SPEC_DIR = 'e2e'

const ID = /^([A-Z]+-[A-Z]+)-(\d{3})$/
const SPEC_TITLE = /^([A-Z]+-[A-Z]+-\d{3}) (\S.*)$/s
const BULLET = /^( *)- (.*)$/
const PACK_LINE = /^\[([^\]]+)\]\(([^)]+\.spec\.ts)\)\s*—\s*`([A-Z]+-[A-Z]+)`\s*$/
const DESCRIBE_LINE = /^\*([^*].*)\*$/
const NUMBERED_LINE = /^\*\*([A-Z]+-[A-Z]+-\d{3})\*\* (\S.*)$/
const HEADING_LINE = /^\*\*[^*]+\*\*$/
const TEST_MODIFIERS = new Set(['skip', 'fixme', 'only', 'fail', 'slow'])

// ---------------------------------------------------------------- the plan

// Reads the tree under the plan's first heading; a later `## ` heading ends
// it, so prose about work not yet planned in detail can follow.
function parsePlan() {
  const text = fs.readFileSync(path.join(ROOT, PLAN), 'utf8')
  const lines = text.split('\n')
  const packs = []
  const errors = []
  let pack = null
  let describes = [] // [{ depth, title }]
  let seenHeading = false

  lines.forEach((line, index) => {
    const no = index + 1
    if (line.startsWith('# ')) {
      if (seenHeading) return
      seenHeading = true
      return
    }
    if (line.startsWith('## ')) {
      pack = null
      describes = []
      return
    }
    const bullet = BULLET.exec(line)
    if (!bullet) return
    const depth = bullet[1].length / 2
    const body = bullet[2].trim()

    const asPack = PACK_LINE.exec(body)
    if (asPack) {
      pack = { file: asPack[2], prefix: asPack[3], depth, line: no, tests: [] }
      packs.push(pack)
      describes = []
      return
    }
    if (HEADING_LINE.test(body)) {
      // A page or feature heading: closes the pack above it.
      pack = null
      describes = []
      return
    }
    if (!pack || depth <= pack.depth) {
      pack = null
      return
    }
    describes = describes.filter((d) => d.depth < depth)
    const asDescribe = DESCRIBE_LINE.exec(body)
    if (asDescribe) {
      describes.push({ depth, title: asDescribe[1] })
      return
    }
    const asNumbered = NUMBERED_LINE.exec(body)
    pack.tests.push({
      id: asNumbered ? asNumbered[1] : null,
      title: asNumbered ? asNumbered[2] : body,
      describes: describes.map((d) => d.title),
      line: no,
      lineIndex: index,
    })
  })

  const prefixes = new Map()
  const ids = new Map()
  for (const p of packs) {
    if (!fs.existsSync(path.join(ROOT, p.file))) errors.push(`${PLAN}:${p.line}: ${p.file} does not exist`)
    if (prefixes.has(p.prefix)) errors.push(`${PLAN}:${p.line}: prefix ${p.prefix} is also used on line ${prefixes.get(p.prefix)}`)
    prefixes.set(p.prefix, p.line)
    for (const t of p.tests) {
      if (!t.id) continue
      if (!t.id.startsWith(`${p.prefix}-`)) errors.push(`${PLAN}:${t.line}: ${t.id} does not use the pack prefix ${p.prefix}`)
      if (ids.has(t.id)) errors.push(`${PLAN}:${t.line}: ${t.id} is also used on line ${ids.get(t.id)}`)
      ids.set(t.id, t.line)
    }
  }
  return { lines, packs, errors }
}

// --------------------------------------------------------------- the specs

function listSpecs(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return listSpecs(rel)
    return entry.name.endsWith('.spec.ts') ? [rel] : []
  })
}

// `test(...)`, `test.skip(...)`, `test.describe(...)`, `test.describe.serial(...)`
// → { kind, modifier, title }; anything else (hooks, `test.step`, conditional
// `test.skip(cond)`) → null.
function classify(call) {
  const chain = []
  let expr = call.expression
  while (ts.isPropertyAccessExpression(expr)) {
    chain.unshift(expr.name.text)
    expr = expr.expression
  }
  if (!ts.isIdentifier(expr) || expr.text !== 'test') return null
  const first = call.arguments[0]
  if (!first || !(ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) return null
  if (chain[0] === 'describe') return { kind: 'describe', modifier: null, title: first.text }
  if (chain.length === 0) return { kind: 'test', modifier: null, title: first.text }
  if (chain.length === 1 && TEST_MODIFIERS.has(chain[0])) return { kind: 'test', modifier: chain[0], title: first.text }
  return null
}

// One spec file → its tests in file order, each with its describe chain.
function parseSpec(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const tests = []
  const visit = (node, describes) => {
    if (ts.isCallExpression(node)) {
      const found = classify(node)
      if (found) {
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
        if (found.kind === 'describe') {
          node.arguments.forEach((arg) => visit(arg, [...describes, found.title]))
        } else {
          const match = SPEC_TITLE.exec(found.title)
          tests.push({
            id: match ? match[1] : null,
            title: match ? match[2] : found.title,
            describes,
            modifier: found.modifier,
            line,
          })
        }
        return
      }
    }
    ts.forEachChild(node, (child) => visit(child, describes))
  }
  visit(source, [])
  return tests
}

// ----------------------------------------------------------------- compare

function compare(plan) {
  const errors = [...plan.errors]
  const planned = new Map() // id → { pack, test }
  for (const pack of plan.packs) for (const test of pack.tests) if (test.id) planned.set(test.id, { pack, test })
  const written = new Set()
  const packByFile = new Map(plan.packs.map((p) => [p.file, p]))

  for (const file of listSpecs(SPEC_DIR)) {
    const pack = packByFile.get(file)
    if (!pack) {
      errors.push(`${file}: not in ${PLAN}`)
      continue
    }
    for (const t of parseSpec(file)) {
      const where = `${file}:${t.line}`
      if (!t.id) {
        errors.push(`${where}: no test ID in "${t.title}"`)
        continue
      }
      const entry = planned.get(t.id)
      if (!entry) {
        errors.push(`${where}: ${t.id} is not in ${PLAN}`)
        continue
      }
      written.add(t.id)
      if (entry.pack.file !== file) errors.push(`${where}: ${t.id} is planned in ${entry.pack.file}`)
      if (entry.test.title !== t.title) errors.push(`${where}: ${t.id} title differs from the plan\n    plan: ${entry.test.title}\n    spec: ${t.title}`)
      const want = entry.test.describes.join(' › ')
      const have = t.describes.join(' › ')
      if (want !== have) errors.push(`${where}: ${t.id} sits under "${have || '(top level)'}", the plan puts it under "${want || '(top level)'}"`)
    }
  }

  const open = []
  for (const pack of plan.packs) {
    for (const test of pack.tests) {
      if (!test.id) open.push({ pack, test, state: 'unnumbered' })
      else if (!written.has(test.id)) open.push({ pack, test, state: 'to write' })
    }
  }
  return { errors, open, plannedCount: planned.size, writtenCount: written.size }
}

// ------------------------------------------------------------------- modes

function assign(plan) {
  let assigned = 0
  for (const pack of plan.packs) {
    let next = Math.max(0, ...pack.tests.flatMap((t) => (t.id ? [Number(ID.exec(t.id)[2])] : []))) + 1
    for (const test of pack.tests) {
      if (test.id) continue
      const id = `${pack.prefix}-${String(next++).padStart(3, '0')}`
      const line = plan.lines[test.lineIndex]
      plan.lines[test.lineIndex] = line.replace(/^( *- )/, `$1**${id}** `)
      assigned++
    }
  }
  if (assigned) fs.writeFileSync(path.join(ROOT, PLAN), plan.lines.join('\n'))
  return assigned
}

const mode = process.argv[2]
const plan = parsePlan()

if (mode === 'assign') {
  if (plan.errors.length) {
    console.error(plan.errors.join('\n'))
    process.exit(1)
  }
  console.log(`Numbered ${assign(plan)} tests in ${PLAN}.`)
  process.exit(0)
}

if (mode === 'check' || mode === 'status') {
  const { errors, open, plannedCount, writtenCount } = compare(plan)
  if (errors.length) {
    console.error(errors.join('\n'))
    if (mode === 'check') process.exit(1)
  }
  if (mode === 'status') {
    const byPack = new Map()
    for (const o of open) {
      if (!byPack.has(o.pack)) byPack.set(o.pack, [])
      byPack.get(o.pack).push(o)
    }
    for (const [pack, items] of byPack) {
      console.log(`${pack.file} (${pack.prefix})`)
      for (const { test, state } of items) {
        const under = test.describes.length ? ` [${test.describes.join(' › ')}]` : ''
        console.log(`  ${state === 'unnumbered' ? '(no ID)' : test.id}  ${test.title}${under}`)
      }
    }
    const unnumbered = open.filter((o) => o.state === 'unnumbered').length
    console.log(`\n${writtenCount} of ${plannedCount} planned tests written, ${plannedCount - writtenCount} to write${unnumbered ? `, ${unnumbered} unnumbered (run "npm run test:plan:assign")` : ''}.`)
  } else if (!errors.length) {
    console.log(`Specs match the plan: ${writtenCount} of ${plannedCount} planned tests written.`)
  }
  process.exit(0)
}

console.error('Usage: node scripts/test-plan.mjs check | status | assign')
process.exit(2)
