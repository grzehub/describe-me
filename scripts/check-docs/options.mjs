import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { elementWithId } from '../docs/element-with-id.mjs'

const PAGE = 'configuration.html'
const PLUGIN = 'packages/vitest/src/plugin.ts'
const CLI_DIR = 'packages/viewer/cli'
const EXAMPLES_DIR = 'examples'
const EXAMPLE_CONFIG = 'vitest.config.ts'
const INTERFACE = /\bexport\s+interface\s+DescribeMeOptions\b[^{]*\{/
// Line comments only where `//` cannot be part of a URL in a string.
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm
const PROPERTY = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/
const ENV_READ = /\bprocess\.env\??\.([A-Za-z_][\w]*)/g
// `=` but not `==` or `===`, so a comparison is not an assignment.
const ENV_ASSIGNMENT = /\bprocess\.env\.([A-Za-z_][\w]*)\s*=(?!=)/g
const CODE = /<code\b[^>]*>([\s\S]*?)<\/code>/gi

/**
 * configuration.html documents every option of `describeMe()` and every
 * environment variable, and nothing else. Each key of `DescribeMeOptions` in
 * packages/vitest/src/plugin.ts has a row `option-<name>` that shows the name
 * in `<code>`. Each variable the example configs read, or the CLI sets, has a
 * row `env-<NAME>`. Every `option-*` and `env-*` id names one of them. An
 * empty source is a problem, so a refactor cannot make the check vacuous.
 */
export default function options(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing`]
  }

  const page = { context, html, ids: context.helpers.idsIn(html) }
  const optionRows = {
    prefix: 'option',
    names: optionNames(context.root),
    source: `${PLUGIN} DescribeMeOptions`,
  }

  const envRows = {
    prefix: 'env',
    names: envNames(context.root),
    source: 'the example configs and the CLI',
  }

  return [...checkRows(page, optionRows), ...checkRows(page, envRows)]
}

/** The property names of `interface DescribeMeOptions`, at the top level of its body. */
function optionNames(root) {
  const source = withoutComments(join(root, PLUGIN))
  const head = INTERFACE.exec(source)

  if (!head) {
    return []
  }

  return topLevelLines(source, head.index + head[0].length)
    .map((line) => PROPERTY.exec(line)?.[1])
    .filter((name) => name !== undefined)
}

/** The lines of a body that starts after its `{`, with everything inside nested braces left out. */
function topLevelLines(source, from) {
  let depth = 0
  let text = ''

  for (let index = from; index < source.length; index++) {
    const character = source[index]

    if (character === '{') {
      depth++
    } else if (character === '}') {
      if (depth === 0) {
        break
      }

      depth--
    } else if (depth === 0) {
      text += character
    }
  }

  return text.split(/[\n;]/)
}

/** Every variable an example's vitest.config.ts reads and every one the CLI sets. */
function envNames(root) {
  const names = new Set()

  for (const example of readdirSync(join(root, EXAMPLES_DIR))) {
    const file = join(root, EXAMPLES_DIR, example, EXAMPLE_CONFIG)

    if (existsSync(file)) {
      addMatches(names, withoutComments(file), ENV_READ)
    }
  }

  for (const file of readdirSync(join(root, CLI_DIR))) {
    if (file.endsWith('.ts')) {
      addMatches(names, withoutComments(join(root, CLI_DIR, file)), ENV_ASSIGNMENT)
    }
  }

  return [...names]
}

function withoutComments(file) {
  return readFileSync(file, 'utf8').replace(COMMENT, '$1')
}

function addMatches(names, source, pattern) {
  for (const match of source.matchAll(pattern)) {
    names.add(match[1])
  }
}

/** Both directions for one kind of row: a row per name, and a name per row. */
function checkRows({ context, html, ids }, { prefix, names, source }) {
  if (names.length === 0) {
    return [`${PAGE}: found no names for ${prefix}-* rows in ${source}`]
  }

  const problems = []

  for (const name of names) {
    const id = `${prefix}-${name}`
    const row = elementWithId(html, id)

    if (row === null) {
      problems.push(`${PAGE}: no element with id="${id}" for ${name} from ${source}`)
    } else if (!codeTexts(context, row).includes(name)) {
      problems.push(`${PAGE}: ${id} needs <code>${name}</code>`)
    }
  }

  for (const id of ids) {
    if (id.startsWith(`${prefix}-`) && !names.includes(id.slice(prefix.length + 1))) {
      problems.push(`${PAGE}: ${id} names nothing in ${source}`)
    }
  }

  return problems
}

/** The text of every `<code>` in a fragment, entities decoded and whitespace collapsed. */
function codeTexts(context, fragment) {
  return [...fragment.matchAll(CODE)].map((match) =>
    context.helpers.decodeEntities(context.helpers.stripTags(match[1])).replace(/\s+/g, ' ').trim(),
  )
}
