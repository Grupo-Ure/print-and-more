// Loads and compiles every registered template once, when the function
// starts, and renders a template's subject / html / text from its data.
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
  subject: Compiled
  html: Compiled
  text: Compiled
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
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

// Only the html body escapes interpolated values; the subject and the plain
// text body are not HTML, so escaping would put entities into them.
async function loadTemplate(name: TemplateName): Promise<CompiledTemplate> {
  const [subject, html, text] = await Promise.all([
    loadFile(`${name}/subject.hbs`, false),
    loadFile(`${name}/html.hbs`, true),
    loadFile(`${name}/text.hbs`, false),
  ])
  return { subject, html, text }
}

const layout = await loadFile('layout.hbs', true)

const compiledByName = new Map<TemplateName, CompiledTemplate>(
  await Promise.all(TEMPLATE_NAMES.map(async name => [name, await loadTemplate(name)] as const)),
)

/** Renders a registered template; every html body is wrapped in the shared layout. */
export function renderEmail(name: TemplateName, data: Record<string, unknown>): RenderedEmail {
  const template = compiledByName.get(name)
  if (!template) throw new Error(`Email template ${name} is registered but was not loaded`)

  const subject = template.subject(data).trim().replace(/\s+/g, ' ')
  const body = template.html(data)
  return {
    subject,
    html: layout({ subject, body }),
    text: template.text(data).trim() + '\n',
  }
}
