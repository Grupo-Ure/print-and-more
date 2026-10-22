import Handlebars from 'handlebars'

/**
 * Why a mail's wording (`email_settings.subject` / `.body`) cannot be saved.
 * The sender renders the wording with Handlebars, strict: anything but text
 * and plain `{{name}}` slots from the row's `placeholders` would either fail
 * every send or let the wording run code paths nobody reviewed.
 */
export type WordingProblem =
  | { kind: 'blank' }
  | { kind: 'unparsable'; detail: string }
  /** A block, helper call, partial, comment, triple-stash or path where only `{{name}}` may stand. */
  | { kind: 'not_a_slot'; source: string }
  /** A `{{name}}` the mail does not offer. */
  | { kind: 'unknown_slot'; name: string }

export type WordingCheck = { ok: true } | { ok: false; problem: WordingProblem }

/** Text, or the source a statement was written as, for the message. */
function sourceOf(statement: hbs.AST.Statement, text: string): string {
  const { start, end } = statement.loc
  const lines = text.split('\n')
  if (start.line !== end.line) return lines[start.line - 1]?.slice(start.column) ?? ''
  return lines[start.line - 1]?.slice(start.column, end.column) ?? ''
}

/**
 * Checks one field of a mail's wording against the slots the mail offers.
 * Pure: parses, never renders, so it needs no data.
 */
export function checkWording(text: string, placeholders: readonly string[]): WordingCheck {
  if (text.trim() === '') return { ok: false, problem: { kind: 'blank' } }

  let program: hbs.AST.Program
  try {
    program = Handlebars.parse(text)
  } catch (error) {
    return { ok: false, problem: { kind: 'unparsable', detail: error instanceof Error ? error.message : String(error) } }
  }

  for (const statement of program.body) {
    if (statement.type === 'ContentStatement') continue
    if (statement.type !== 'MustacheStatement') {
      return { ok: false, problem: { kind: 'not_a_slot', source: sourceOf(statement, text) } }
    }
    const mustache = statement as hbs.AST.MustacheStatement
    const path = mustache.path as hbs.AST.PathExpression
    const isPlainSlot =
      mustache.escaped &&
      mustache.params.length === 0 &&
      !mustache.hash &&
      path.type === 'PathExpression' &&
      !path.data &&
      path.depth === 0 &&
      path.parts.length === 1 &&
      path.original === path.parts[0]
    if (!isPlainSlot) return { ok: false, problem: { kind: 'not_a_slot', source: sourceOf(statement, text) } }
    if (!placeholders.includes(path.original)) return { ok: false, problem: { kind: 'unknown_slot', name: path.original } }
  }
  return { ok: true }
}

/** What the wording dialog says about a problem. */
export function wordingProblemMessage(problem: WordingProblem): string {
  switch (problem.kind) {
    case 'blank':
      return 'This field cannot be empty.'
    case 'unparsable':
      return 'The braces do not match up. Use a placeholder as {{name}}, with two braces on each side.'
    case 'not_a_slot':
      return `${problem.source} is not a placeholder. Only {{name}} with one of this mail's placeholders may stand in braces.`
    case 'unknown_slot':
      return `This mail has no placeholder {{${problem.name}}}.`
  }
}
