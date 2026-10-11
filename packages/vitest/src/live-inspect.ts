/** How far `print` goes: nested levels, and items per list. */
interface PrintLimits {
  maxDepth: number
  maxWidth: number
}

const MAX_DEPTH = 10
const UNQUOTED_KEY = /^[a-z_]\w*$/i
const LIST_TAGS = new Set([
  '[object Array]',
  '[object ArrayBuffer]',
  '[object DataView]',
  '[object Float32Array]',
  '[object Float64Array]',
  '[object Int8Array]',
  '[object Int16Array]',
  '[object Int32Array]',
  '[object Uint8Array]',
  '[object Uint8ClampedArray]',
  '[object Uint16Array]',
  '[object Uint32Array]',
])

const SHORTENED_TAGS = new Set([
  '[object Array]',
  '[object Object]',
  '[object Set]',
  '[object Map]',
])

function tagOf(value: unknown): string {
  return Object.prototype.toString.call(value)
}

function constructorName(value: object): string {
  const { constructor } = value as { constructor?: unknown }

  return (typeof constructor === 'function' && constructor.name) || 'Object'
}

function isHighSurrogate(character: string | undefined): boolean {
  return character !== undefined && character >= '\ud800' && character <= '\udbff'
}

/** pretty-format's `printBasicValue` with Vitest's options: single quotes, no escapes. */
function printBasic(value: unknown): string | null {
  if (value === true || value === false) {
    return String(value)
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value)
  }

  if (typeof value === 'bigint') {
    return `${value}n`
  }

  if (typeof value === 'string') {
    return `'${value}'`
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }

  if (typeof value === 'symbol') {
    return String(value)
  }

  return printBasicObject(value)
}

function printBasicObject(value: unknown): string | null {
  const tag = tagOf(value)

  if (tag === '[object WeakMap]') {
    return 'WeakMap {}'
  }

  if (tag === '[object WeakSet]') {
    return 'WeakSet {}'
  }

  if (tag === '[object Date]') {
    const date = value as Date

    return Number.isNaN(+date) ? 'Date { NaN }' : date.toISOString()
  }

  if (tag === '[object Error]' || value instanceof Error) {
    return `[${Error.prototype.toString.call(value)}]`
  }

  if (tag === '[object RegExp]') {
    return RegExp.prototype.toString.call(value)
  }

  return null
}

function printList(
  list: ArrayLike<unknown>,
  limits: PrintLimits,
  depth: number,
  refs: unknown[],
): string {
  if (list.length === 0) {
    return ''
  }

  let result = ' '

  for (let i = 0; i < list.length; i++) {
    if (i === limits.maxWidth) {
      result += `…(${list.length - i})`
      break
    }

    if (i in list) {
      result += print(list[i], limits, depth, refs)
    }

    if (i < list.length - 1) {
      result += ', '
    }
  }

  return `${result} `
}

/** Map entries as `key => value`, Set values alone. */
function printIterated(
  items: unknown[],
  limits: PrintLimits,
  depth: number,
  refs: unknown[],
  entries: boolean,
): string {
  if (items.length === 0) {
    return ''
  }

  let result = ' '

  for (let i = 0; i < items.length; i++) {
    if (i === limits.maxWidth) {
      result += `…(${items.length - i})`
      break
    }

    if (entries) {
      const [key, value] = items[i] as [unknown, unknown]

      result += `${print(key, limits, depth, refs)} => ${print(value, limits, depth, refs)}`
    } else {
      result += print(items[i], limits, depth, refs)
    }

    if (i < items.length - 1) {
      result += ', '
    }
  }

  return `${result} `
}

function printProperties(
  value: object,
  limits: PrintLimits,
  depth: number,
  refs: unknown[],
): string {
  const keys: (string | symbol)[] = Object.keys(value)

  for (const symbol of Object.getOwnPropertySymbols(value)) {
    if (Object.getOwnPropertyDescriptor(value, symbol)?.enumerable) {
      keys.push(symbol)
    }
  }

  if (keys.length === 0) {
    return ''
  }

  let result = ' '

  for (let i = 0; i < keys.length; i++) {
    if (i === limits.maxWidth) {
      result += `…(${keys.length - i})`
      break
    }

    const key = keys[i]
    const unquoted = typeof key === 'string' && key !== '__proto__' && UNQUOTED_KEY.test(key)
    const name = unquoted ? key : print(key, limits, depth, refs)

    result += `${name}: ${print((value as Record<string | symbol, unknown>)[key], limits, depth, refs)}`

    if (i < keys.length - 1) {
      result += ', '
    }
  }

  return `${result} `
}

/** pretty-format's `printComplexValue` with `min: true` and no basic prototype names. */
function printComplex(
  value: object,
  limits: PrintLimits,
  depth: number,
  refs: unknown[],
  calledToJSON: boolean,
): string {
  if (refs.includes(value)) {
    return '[Circular]'
  }

  const nextRefs = [...refs, value]
  const nextDepth = depth + 1
  const hitMaxDepth = nextDepth > limits.maxDepth
  const { toJSON } = value as { toJSON?: unknown }

  if (!hitMaxDepth && typeof toJSON === 'function' && !calledToJSON) {
    return print(toJSON.call(value), limits, nextDepth, nextRefs, true)
  }

  const tag = tagOf(value)
  const name = constructorName(value)

  if (tag === '[object Arguments]') {
    return hitMaxDepth
      ? '[Arguments]'
      : `[${printList(value as ArrayLike<unknown>, limits, nextDepth, nextRefs)}]`
  }

  if (LIST_TAGS.has(tag)) {
    const prefix = name === 'Array' ? '' : `${name} `

    return hitMaxDepth
      ? `[${name}]`
      : `${prefix}[${printList(value as ArrayLike<unknown>, limits, nextDepth, nextRefs)}]`
  }

  if (tag === '[object Map]') {
    const entries = [...(value as Map<unknown, unknown>).entries()]

    return hitMaxDepth
      ? '[Map]'
      : `Map {${printIterated(entries, limits, nextDepth, nextRefs, true)}}`
  }

  if (tag === '[object Set]') {
    const values = [...(value as Set<unknown>).values()]

    return hitMaxDepth
      ? '[Set]'
      : `Set {${printIterated(values, limits, nextDepth, nextRefs, false)}}`
  }

  if (hitMaxDepth) {
    return `[${name}]`
  }

  return `${name === 'Object' ? '' : `${name} `}{${printProperties(value, limits, nextDepth, nextRefs)}}`
}

function print(
  value: unknown,
  limits: PrintLimits,
  depth = 0,
  refs: unknown[] = [],
  calledToJSON = false,
): string {
  return printBasic(value) ?? printComplex(value as object, limits, depth, refs, calledToJSON)
}

/** Vitest's `stringify`: it halves the depth until the output is shorter than `maxLength`. */
function stringify(value: unknown, maxDepth: number, maxLength: number): string {
  const result = print(value, { maxDepth, maxWidth: Number.POSITIVE_INFINITY })

  return result.length >= maxLength && maxDepth > 1
    ? stringify(value, Math.floor(maxDepth / 2), maxLength)
    : result
}

/** The widest list at depth 1 whose output stays within `threshold`. */
function stringifyByMaxWidth(value: unknown, threshold: number): string {
  const evaluate = (maxWidth: number) => print(value, { maxDepth: 1, maxWidth })
  let low = 0
  let high = threshold

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)

    if (evaluate(middle).length <= threshold) {
      low = middle
    } else {
      high = middle
    }
  }

  return evaluate(low)
}

/**
 * A port of `inspect` from Vitest 5's display utilities, which prints values
 * in test names with pretty-format: `'x'`, `{ a: 1 }`, `[ 1, 2 ]`. Output
 * longer than `truncate` is cut the way Vitest cuts it. DOM nodes and React
 * elements, which Vitest prints with plugins, are printed as plain objects.
 */
export function liveInspect(value: unknown, truncate: number): string {
  const formatted = stringify(value, MAX_DEPTH, truncate || 10_000)

  if (truncate === 0 || formatted.length <= truncate) {
    return formatted
  }

  if (typeof value === 'string') {
    let end = truncate - 1

    if (end > 0 && isHighSurrogate(formatted[end - 1])) {
      end -= 1
    }

    return `'${formatted.slice(1, end)}…'`
  }

  if (SHORTENED_TAGS.has(tagOf(value))) {
    return stringifyByMaxWidth(value, truncate)
  }

  return print(value, { maxDepth: 0, maxWidth: Number.POSITIVE_INFINITY })
}
