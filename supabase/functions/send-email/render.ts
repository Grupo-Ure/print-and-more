// Loads and compiles every registered template's structure once, when the
// function starts, and renders a mail from its wording and its data.
//
// The wording — subject and body — is the template's email_settings row,
// which the shop edits in Settings → Emails, so it is compiled at send time.
// It is compiled strict: a slot the data has no value for fails the render
// instead of printing nothing. The rendered body goes into the folder's
// html.hbs escaped, as paragraphs, and into its text.hbs as it is.
//
// The .hbs files reach the deployed function as static files (config.toml,
// [functions.send-email] static_files). Loading happens at module
// evaluation, so a registered template with a missing or malformed file
// stops the worker from booting: it shows on deploy, before any mail is
// claimed.

import Handlebars from 'handlebars'
import { TEMPLATE_NAMES, type TemplateName } from './templates/registry.ts'

type Compiled = Handlebars.TemplateDelegate<Record<string, unknown>>

interface CompiledTemplate {
  html: Compiled
  text: Compiled
}

/** A template's wording, as its email_settings row holds it. */
export interface Wording {
  subject: string
  body: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** The wording does not render with the mail's data: a slot without a value, or text that does not parse. */
export class WordingError extends Error {
  constructor(readonly field: keyof Wording, cause: unknown) {
    super(`The ${field} of the mail's wording does not render: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    this.name = 'WordingError'
  }
}

const TEMPLATES_DIR = new URL('./templates/', import.meta.url)

async function readTemplateFile(relativePath: string): Promise<string> {
  try {
    return await Deno.readTextFile(new URL(relativePath, TEMPLATES_DIR))
  } catch (cause) {
    throw new Error(`Email template file templates/${relativePath} could not be read`, { cause })
  }
}

// Handlebars.compile() is lazy: it parses on the first render, not when
// called. Parsing up front is what makes a syntax error fail the start-up.
function compileStrictly(source: string, relativePath: string, escapeHtml: boolean): Compiled {
  try {
    Handlebars.parse(source)
  } catch (cause) {
    throw new Error(`Email template file templates/${relativePath} does not parse`, { cause })
  }
  return Handlebars.compile(source, { noEscape: !escapeHtml })
}

async function loadFile(relativePath: string, escapeHtml: boolean): Promise<Compiled> {
  return compileStrictly(await readTemplateFile(relativePath), relativePath, escapeHtml)
}

// Only the html body escapes interpolated values; the plain text body is not
// HTML, so escaping would put entities into it.
async function loadTemplate(name: TemplateName): Promise<CompiledTemplate> {
  const [html, text] = await Promise.all([
    loadFile(`${name}/html.hbs`, true),
    loadFile(`${name}/text.hbs`, false),
  ])
  return { html, text }
}

const layout = await loadFile('layout.hbs', true)

const compiledByName = new Map<TemplateName, CompiledTemplate>(
  await Promise.all(TEMPLATE_NAMES.map(async name => [name, await loadTemplate(name)] as const)),
)

/** The inline style of a body paragraph; mail clients take no stylesheet. */
const PARAGRAPH_STYLE = 'margin: 0 0 16px;'

/** Renders one field of the wording, unescaped: escaping is the html body's job, and the subject is not HTML. */
function renderWording(source: string, field: keyof Wording, data: Record<string, unknown>): string {
  try {
    return Handlebars.compile(source, { strict: true, noEscape: true })(data)
  } catch (cause) {
    throw new WordingError(field, cause)
  }
}

/** The rendered body as html: escaped, a blank line starting a paragraph and a single line break kept as <br>. */
function bodyHtml(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph !== '')
    .map(paragraph => `<p style="${PARAGRAPH_STYLE}">${Handlebars.escapeExpression(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

/**
 * Renders a registered template with its wording; every html body is wrapped
 * in the shared layout. Throws WordingError when the wording does not render.
 */
export function renderEmail(name: TemplateName, wording: Wording, data: Record<string, unknown>): RenderedEmail {
  const template = compiledByName.get(name)
  if (!template) throw new Error(`Email template ${name} is registered but was not loaded`)

  const subject = renderWording(wording.subject, 'subject', data).trim().replace(/\s+/g, ' ')
  const body = renderWording(wording.body, 'body', data).replace(/\r\n?/g, '\n').trim()
  return {
    subject,
    html: layout({ subject, body: template.html({ ...data, body: bodyHtml(body) }) }),
    text: template.text({ ...data, body }).trim() + '\n',
  }
}
