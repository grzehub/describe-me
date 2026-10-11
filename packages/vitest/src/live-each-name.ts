import { liveFormatPlaceholder } from './live-format-placeholder.js'
import { liveInspect } from './live-inspect.js'
import { liveLoupeInspect } from './live-loupe-inspect.js'

/** How one major version of Vitest prints the values of a row. */
interface NameRules {
  /** The `$key` pattern. */
  key: RegExp
  /** A value that `$key` names. */
  display(value: unknown): string
  /** The value an object takes for `%s`, `%o`, `%O` and after `%%`. */
  inspect(value: unknown): string
}

const PLACEHOLDER = /%[sdjifoOc%]/g
const ARRAY_KEY = /^\d+$/
// `taskTitleValueFormatTruncate` in Vitest 5, `chaiConfig.truncateThreshold` in Vitest 4.
const TRUNCATE = 40

function isObject(item: unknown): boolean {
  return item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item)
}

function isNegativeNaN(value: unknown): boolean {
  if (!Number.isNaN(value)) {
    return false
  }

  const float = new Float64Array(1)

  float[0] = value as number

  return new Uint32Array(float.buffer)[1] >>> 31 === 1
}

/** Vitest's `objectAttr`: a property path such as `a.b` or `a[0]`, or `fallback` where it ends. */
function objectAttr(source: unknown, path: string, fallback?: unknown): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let result = source

  for (const part of parts) {
    result = (Object(result) as Record<string, unknown>)[part]

    if (result === undefined) {
      return fallback
    }
  }

  return result
}

/** Vitest 5's `truncateString`. */
function truncateString(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  let end = maxLength - 1
  const before = text[end - 1]

  if (before >= '\ud800' && before <= '\udbff') {
    end -= 1
  }

  return `${text.slice(0, end)}…`
}

/** Vitest 4's `objDisplay`: loupe's output, or a summary once it reaches the threshold. */
function objDisplay(value: unknown): string {
  const text = liveLoupeInspect(value, TRUNCATE)

  if (text.length < TRUNCATE) {
    return text
  }

  const tag = Object.prototype.toString.call(value)

  if (tag === '[object Function]') {
    const { name } = value as { name?: string }

    return name ? `[Function: ${name}]` : '[Function]'
  }

  if (tag === '[object Array]') {
    return `[ Array(${(value as unknown[]).length}) ]`
  }

  if (tag === '[object Object]') {
    const keys = Object.keys(value as object)
    const shown = keys.length > 2 ? `${keys.splice(0, 2).join(', ')}, ...` : keys.join(', ')

    return `{ Object (${shown}) }`
  }

  return text
}

const VITEST_5: NameRules = {
  key: /\$([$\p{ID_Continue}.]+)/gu,
  display: (value) =>
    typeof value === 'string' ? truncateString(value, TRUNCATE) : liveInspect(value, TRUNCATE),
  inspect: (value) => liveInspect(value, TRUNCATE),
}

const VITEST_4: NameRules = {
  key: /\$([$\w.]+)/g,
  display: objDisplay,
  inspect: (value) => liveLoupeInspect(value, Number.POSITIVE_INFINITY),
}

/** `%#` and `%$`, the 0-based and 1-based row index, go in before any value. */
function withIndex(template: string, index: number): string {
  if (!template.includes('%#') && !template.includes('%$')) {
    return template
  }

  return template
    .replace(/%%/g, '__vitest_escaped_%__')
    .replace(/%#/g, `${index}`)
    .replace(/%\$/g, `${index + 1}`)
    .replace(/__vitest_escaped_%__/g, '%%')
}

/** Vitest puts a `-` before the i-th `%f` when the i-th value, not that `%f`'s own, is -0 or a negative NaN. */
function withNegativeFloats(template: string, items: unknown[]): string {
  if (!template.includes('%f')) {
    return template
  }

  let result = template
  const placeholders = template.match(/%f/g) ?? []

  placeholders.forEach((_, i) => {
    if (isNegativeNaN(items[i]) || Object.is(items[i], -0)) {
      let occurrence = 0

      result = result.replace(/%f/g, (match) => {
        occurrence += 1

        return occurrence === i + 1 ? '-%f' : match
      })
    }
  })

  return result
}

/** `$key`, `$a.b` and `$0` outside the placeholders. */
function withKeys(text: string, items: unknown[], rules: NameRules): string {
  const isObjectItem = isObject(items[0])

  return text.replace(rules.key, (_, key: string) => {
    const isArrayKey = ARRAY_KEY.test(key)

    if (!isObjectItem && !isArrayKey) {
      return `$${key}`
    }

    const arrayElement = isArrayKey ? objectAttr(items, key) : undefined
    const value = isObjectItem ? objectAttr(items[0], key, arrayElement) : arrayElement

    return rules.display(value)
  })
}

/**
 * The name of one row of `each` or `for`, a port of Vitest's `formatTitle`
 * with its quirks, because the manifest holds the names Vitest gave. Vitest 5
 * and 4 differ in how they print values, so `vitestMajor` picks the rules.
 */
export function liveEachName(
  template: string,
  items: unknown[],
  index: number,
  vitestMajor: number,
): string {
  const rules = vitestMajor >= 5 ? VITEST_5 : VITEST_4
  const indexed = withIndex(template, index)
  const count = indexed.split('%').length - 1
  const named = withNegativeFloats(indexed, items)
  let output = ''
  let next = 0
  let end = 0

  for (const match of named.matchAll(PLACEHOLDER)) {
    if (end < match.index) {
      output += withKeys(named.slice(end, match.index), items, rules)
    }

    if (next < count) {
      output += liveFormatPlaceholder(match[0], items[next], rules.inspect)
      next += 1
    } else {
      output += match[0]
    }

    end = match.index + match[0].length
  }

  if (end < named.length) {
    output += withKeys(named.slice(end), items, rules)
  }

  return output
}
