/** loupe's options that matter here: the length left, and the objects on the current path. */
interface LoupeOptions {
  truncate: number
  seen: unknown[]
}

type Inspector = (value: unknown, options: LoupeOptions) => string

const TRUNCATOR = '…'
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*$/

const ESCAPES: Record<string, string> = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  "'": "\\'",
}

// The code units loupe escapes in strings: control and invisible characters, and `'`.
const ESCAPED_RANGES: [number, number][] = [
  [0x27, 0x27],
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x600, 0x604],
  [0x70f, 0x70f],
  [0x17b4, 0x17b5],
  [0x200c, 0x200f],
  [0x2028, 0x202f],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff0, 0xffff],
]

function isHighSurrogate(character: string | undefined): boolean {
  return character !== undefined && character >= '\ud800' && character <= '\udbff'
}

function truncate(value: unknown, length: number, tail = TRUNCATOR): string {
  const text = String(value)

  if (tail.length > length && text.length > tail.length) {
    return tail
  }

  if (text.length > length && text.length > tail.length) {
    let end = length - tail.length

    if (end > 0 && isHighSurrogate(text[end - 1])) {
      end -= 1
    }

    return `${text.slice(0, end)}${tail}`
  }

  return text
}

function escaped(text: string): string {
  let result = ''

  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    const escape = ESCAPED_RANGES.some(([from, to]) => unit >= from && unit <= to)

    result += escape ? (ESCAPES[text[i]] ?? `\\u${`0000${unit.toString(16)}`.slice(-4)}`) : text[i]
  }

  return result
}

/** loupe's `inspectList`: items until the length runs out, then `…(n)` for the rest. */
function inspectList(
  list: unknown[],
  options: LoupeOptions,
  inspectItem: Inspector = inspectValue,
  separator = ', ',
): string {
  const size = list.length

  if (size === 0) {
    return ''
  }

  const originalLength = options.truncate
  let output = ''
  let peek = ''
  let truncated = ''

  for (let i = 0; i < size; i += 1) {
    const last = i + 1 === list.length
    const secondToLast = i + 2 === list.length

    truncated = `${TRUNCATOR}(${list.length - i})`
    options.truncate = originalLength - output.length - (last ? 0 : separator.length)

    const text = peek || inspectItem(list[i], options) + (last ? '' : separator)
    const nextLength = output.length + text.length
    const truncatedLength = nextLength + truncated.length

    if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
      break
    }

    if (!last && !secondToLast && truncatedLength > originalLength) {
      break
    }

    peek = last ? '' : inspectItem(list[i + 1], options) + (secondToLast ? '' : separator)

    if (
      !last &&
      secondToLast &&
      truncatedLength > originalLength &&
      nextLength + peek.length > originalLength
    ) {
      break
    }

    output += text

    if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
      truncated = `${TRUNCATOR}(${list.length - i - 1})`
      break
    }

    truncated = ''
  }

  return `${output}${truncated}`
}

function quoteComplexKey(key: string): string {
  if (IDENTIFIER.test(key)) {
    return key
  }

  const inner = JSON.stringify(key).slice(1, -1).split("'").join("\\'").split('\\"').join('"')

  return `'${inner}'`
}

function inspectProperty(entry: unknown, options: LoupeOptions): string {
  const [key, value] = entry as [unknown, unknown]

  options.truncate -= 2

  let name: string

  if (typeof key === 'string') {
    name = quoteComplexKey(key)
  } else if (typeof key === 'number') {
    name = String(key)
  } else {
    name = `[${inspectValue(key, options)}]`
  }

  options.truncate -= name.length

  return `${name}: ${inspectValue(value, options)}`
}

function inspectArray(value: unknown, options: LoupeOptions): string {
  const array = value as unknown[]
  const nonIndexProperties = Object.keys(array).slice(array.length)

  if (!array.length && !nonIndexProperties.length) {
    return '[]'
  }

  options.truncate -= 4

  const listContents = inspectList(array, options)

  options.truncate -= listContents.length

  const propertyContents = nonIndexProperties.length
    ? inspectList(
        nonIndexProperties.map((key) => [key, (array as unknown as Record<string, unknown>)[key]]),
        options,
        inspectProperty,
      )
    : ''

  return `[ ${listContents}${propertyContents ? `, ${propertyContents}` : ''} ]`
}

function inspectObject(value: unknown, options: LoupeOptions): string {
  const object = value as Record<string | symbol, unknown>
  const properties = Object.getOwnPropertyNames(object)
  const symbols = Object.getOwnPropertySymbols(object)

  if (properties.length === 0 && symbols.length === 0) {
    return '{}'
  }

  options.truncate -= 4

  if (options.seen.includes(object)) {
    return '[Circular]'
  }

  options.seen.push(object)

  const propertyContents = inspectList(
    properties.map((key) => [key, object[key]]),
    options,
    inspectProperty,
  )

  const symbolContents = inspectList(
    symbols.map((key) => [key, object[key]]),
    options,
    inspectProperty,
  )

  options.seen.pop()

  const separator = propertyContents && symbolContents ? ', ' : ''

  return `{ ${propertyContents}${separator}${symbolContents} }`
}

const ERROR_KEYS = new Set([
  'stack',
  'line',
  'column',
  'name',
  'message',
  'fileName',
  'lineNumber',
  'columnNumber',
  'number',
  'description',
  'cause',
])

/** loupe's error inspector, which never takes the error off `seen` again. */
function inspectError(value: unknown, options: LoupeOptions): string {
  const error = value as Error & Record<string, unknown>
  const properties = Object.getOwnPropertyNames(error).filter((key) => !ERROR_KEYS.has(key))
  const name = String(error.name)

  options.truncate -= name.length

  let message = ''

  if (typeof error.message === 'string') {
    message = truncate(error.message, options.truncate)
  } else {
    properties.unshift('message')
  }

  message = message ? `: ${message}` : ''
  options.truncate -= message.length + 5

  if (options.seen.includes(error)) {
    return '[Circular]'
  }

  options.seen.push(error)

  const propertyContents = inspectList(
    properties.map((key) => [key, error[key]]),
    options,
    inspectProperty,
  )

  return `${name}${message}${propertyContents ? ` { ${propertyContents} }` : ''}`
}

function inspectClass(value: unknown, options: LoupeOptions): string {
  const object = value as { [Symbol.toStringTag]?: unknown; constructor?: { name?: string } }
  let name = Symbol.toStringTag in object ? String(object[Symbol.toStringTag]) : ''

  name = name || object.constructor?.name || ''

  if (!name || name === '_class') {
    name = '<Anonymous Class>'
  }

  options.truncate -= name.length

  return `${name}${inspectObject(value, options)}`
}

function inspectNumber(value: unknown, options: LoupeOptions): string {
  const number = value as number

  if (Number.isNaN(number)) {
    return 'NaN'
  }

  if (number === Number.POSITIVE_INFINITY) {
    return 'Infinity'
  }

  if (number === Number.NEGATIVE_INFINITY) {
    return '-Infinity'
  }

  if (number === 0) {
    return 1 / number === Number.POSITIVE_INFINITY ? '+0' : '-0'
  }

  return truncate(String(number), options.truncate)
}

function inspectBigInt(value: unknown, options: LoupeOptions): string {
  const digits = truncate(String(value), options.truncate - 1)

  return digits === TRUNCATOR ? digits : `${digits}n`
}

function inspectString(value: unknown, options: LoupeOptions): string {
  return `'${truncate(escaped(String(value)), options.truncate - 2)}'`
}

function inspectSymbol(value: unknown): string {
  const { description } = value as symbol

  return description ? `Symbol(${description})` : 'Symbol()'
}

function inspectFunction(value: unknown, options: LoupeOptions): string {
  const fn = value as { name?: string; [Symbol.toStringTag]?: string }
  const type = fn[Symbol.toStringTag] || 'Function'

  if (!fn.name) {
    return `[${type}]`
  }

  return `[${type} ${truncate(fn.name, options.truncate - 11)}]`
}

function inspectDate(value: unknown, options: LoupeOptions): string {
  const json = (value as Date).toJSON()

  if (json === null) {
    return 'Invalid Date'
  }

  const [date, time] = json.split('T')

  return `${date}T${truncate(time, options.truncate - date.length - 1)}`
}

function inspectRegExp(value: unknown, options: LoupeOptions): string {
  const pattern = value as RegExp
  const flags = pattern.toString().split('/')[2]

  return `/${truncate(pattern.source, options.truncate - (2 + flags.length))}/${flags}`
}

function inspectMapEntry(entry: unknown, options: LoupeOptions): string {
  const [key, value] = entry as [unknown, unknown]

  options.truncate -= 4

  const keyText = inspectValue(key, options)

  options.truncate -= keyText.length

  return `${keyText} => ${inspectValue(value, options)}`
}

function inspectMap(value: unknown, options: LoupeOptions): string {
  const map = value as Map<unknown, unknown>

  if (map.size === 0) {
    return 'Map{}'
  }

  options.truncate -= 7

  return `Map{ ${inspectList([...map.entries()], options, inspectMapEntry)} }`
}

function inspectSet(value: unknown, options: LoupeOptions): string {
  const set = value as Set<unknown>

  if (set.size === 0) {
    return 'Set{}'
  }

  options.truncate -= 7

  return `Set{ ${inspectList([...set.values()], options)} }`
}

function inspectArguments(value: unknown, options: LoupeOptions): string {
  const args = Array.from(value as ArrayLike<unknown>)

  if (args.length === 0) {
    return 'Arguments[]'
  }

  options.truncate -= 13

  return `Arguments[ ${inspectList(args, options)} ]`
}

const BASE_TYPES: Record<string, Inspector> = {
  undefined: () => 'undefined',
  null: () => 'null',
  boolean: (value) => String(value),
  Boolean: (value) => String(value),
  number: inspectNumber,
  Number: inspectNumber,
  bigint: inspectBigInt,
  BigInt: inspectBigInt,
  string: inspectString,
  String: inspectString,
  function: inspectFunction,
  Function: inspectFunction,
  symbol: inspectSymbol,
  Symbol: inspectSymbol,
  Array: inspectArray,
  Date: inspectDate,
  Map: inspectMap,
  Set: inspectSet,
  RegExp: inspectRegExp,
  Promise: () => 'Promise{…}',
  WeakSet: () => 'WeakSet{…}',
  WeakMap: () => 'WeakMap{…}',
  Arguments: inspectArguments,
  Generator: () => '',
  DataView: () => '',
  ArrayBuffer: () => '',
  Error: inspectError,
}

/** loupe's `inspect`. Each call works on a copy of the options, as loupe's `normaliseOptions` makes one. */
function inspectValue(value: unknown, parent: LoupeOptions): string {
  const options: LoupeOptions = { truncate: Number(parent.truncate), seen: parent.seen }
  let type: string = value === null ? 'null' : typeof value

  if (type === 'object') {
    type = Object.prototype.toString.call(value).slice(8, -1)
  }

  const inspector = Object.hasOwn(BASE_TYPES, type) ? BASE_TYPES[type] : undefined

  if (inspector !== undefined) {
    return inspector(value, options)
  }

  const proto: unknown = Object.getPrototypeOf(value)

  if (proto === Object.prototype || proto === null) {
    return inspectObject(value, options)
  }

  if ((value as { constructor?: unknown }).constructor !== Object) {
    return inspectClass(value, options)
  }

  return inspectObject(value, options)
}

/**
 * A port of `inspect` from Vitest 4's display utilities, which prints values
 * in test names with loupe: `'x'`, `{ a: 1 }`, `[ 1, 2 ]`, and `+0` for zero.
 * Custom inspectors, typed arrays and DOM nodes print as objects.
 */
export function liveLoupeInspect(value: unknown, truncateAt: number): string {
  return inspectValue(value, {
    truncate: truncateAt === 0 ? Number.POSITIVE_INFINITY : truncateAt,
    seen: [],
  })
}
