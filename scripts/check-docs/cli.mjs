import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { elementWithId } from '../docs/element-with-id.mjs'

const PAGE = 'viewer.html'
const PARSE_ARGS = 'packages/viewer/cli/parse-args.ts'
// Line comments only where `//` cannot be part of a URL in a string.
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm
const COMMAND_TYPE = /\bexport\s+type\s+Command\s*=((?:\s*\|?\s*(?:'[^']*'|"[^"]*"))+)/
const STRING_LITERAL = /'([^']*)'|"([^"]*)"/g
const OPTIONS = /\bparseNodeArgs\s*\(\s*\{[\s\S]*?\boptions\s*:\s*\{/
const OPTION_KEY = /^\s*,?\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*$/
const CODE = /<code\b[^>]*>([\s\S]*?)<\/code>/gi

/**
 * viewer.html documents every command and flag of the `describe-me` CLI, and
 * nothing else. Each member of `Command` in packages/viewer/cli/parse-args.ts
 * has a row `cmd-<command>` with a `<code>` that contains the command. Each
 * option passed to `parseNodeArgs` has a row `flag-<name>` with
 * `<code>--<name></code>`, or `flag-no-<name>` with `<code>--no-<name></code>`
 * for a boolean that defaults to true. The row also shows the short form and
 * the default of a string option in `<code>`. Every `cmd-*` and `flag-*` id
 * names one of them. An empty source is a problem, so a refactor cannot make
 * the check vacuous.
 */
export default function cli(context) {
  const html = context.html.get(PAGE)

  if (html === undefined) {
    return [`${PAGE}: the page is missing`]
  }

  const source = readFileSync(join(context.root, PARSE_ARGS), 'utf8').replace(COMMENT, '$1')
  const commands = commandNames(source)
  const flags = flagRows(source)
  const problems = []

  if (commands.length === 0) {
    problems.push(`${PAGE}: found no commands in ${PARSE_ARGS} (export type Command)`)
  }

  if (flags.length === 0) {
    problems.push(`${PAGE}: found no options in ${PARSE_ARGS} (parseNodeArgs options)`)
  }

  const rows = [...commands.map(commandRow), ...flags]

  for (const row of rows) {
    problems.push(...checkRow(context, html, row))
  }

  const known = new Set(rows.map((row) => row.id))

  for (const id of context.helpers.idsIn(html)) {
    if ((id.startsWith('cmd-') || id.startsWith('flag-')) && !known.has(id)) {
      problems.push(`${PAGE}: ${id} names no command or option in ${PARSE_ARGS}`)
    }
  }

  return problems
}

/** The string literals of `export type Command = 'dev' | 'build' | …`. */
function commandNames(source) {
  const union = COMMAND_TYPE.exec(source)

  if (!union) {
    return []
  }

  return [...union[1].matchAll(STRING_LITERAL)].map((match) => match[1] ?? match[2])
}

function commandRow(command) {
  return {
    id: `cmd-${command}`,
    what: `the command ${command}`,
    contains: [command],
    equals: [],
  }
}

/** One row per key of the `options` object passed to `parseNodeArgs`. */
function flagRows(source) {
  const head = OPTIONS.exec(source)

  if (!head) {
    return []
  }

  return topLevelEntries(source, head.index + head[0].length).map(flagRow)
}

function flagRow({ name, body }) {
  const type = /\btype\s*:\s*['"](\w+)['"]/.exec(body)?.[1]
  const short = /\bshort\s*:\s*['"]([^'"]+)['"]/.exec(body)?.[1]
  const fallback = /\bdefault\s*:\s*(?:'([^']*)'|"([^"]*)"|(true|false))/.exec(body)
  const negated = type === 'boolean' && fallback?.[3] === 'true'
  const flag = negated ? `no-${name}` : name
  const equals = [`--${flag}`]

  if (short !== undefined) {
    equals.push(`-${short}`)
  }

  if (type === 'string' && fallback !== null) {
    equals.push(fallback[1] ?? fallback[2])
  }

  return { id: `flag-${flag}`, what: `the option ${name}`, contains: [], equals }
}

/**
 * The `key: { … }` entries of an object literal whose body starts after its
 * `{`, each with the text inside its own braces.
 */
function topLevelEntries(source, from) {
  const entries = []
  let depth = 0
  let key = ''
  let body = ''

  for (let index = from; index < source.length; index++) {
    const character = source[index]

    if (depth === 0 && character === '}') {
      break
    }

    if (character === '{') {
      depth++

      if (depth === 1) {
        body = ''

        continue
      }
    }

    if (character === '}') {
      depth--

      if (depth === 0) {
        const name = optionKey(key)

        if (name !== undefined) {
          entries.push({ name, body })
        }

        key = ''

        continue
      }
    }

    if (depth === 0) {
      key += character
    } else {
      body += character
    }
  }

  return entries
}

function optionKey(text) {
  const match = OPTION_KEY.exec(text)

  return match ? (match[1] ?? match[2] ?? match[3]) : undefined
}

function checkRow(context, html, { id, what, contains, equals }) {
  const row = elementWithId(html, id)

  if (row === null) {
    return [`${PAGE}: no element with id="${id}" for ${what} in ${PARSE_ARGS}`]
  }

  const shown = codeTexts(context, row)
  const problems = []

  for (const text of contains) {
    if (!shown.some((code) => code.includes(text))) {
      problems.push(`${PAGE}: ${id} needs a <code> that contains ${text}`)
    }
  }

  for (const text of equals) {
    if (!shown.includes(text)) {
      problems.push(`${PAGE}: ${id} needs <code>${text}</code>`)
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
