/** A callback as written, and which of its parameters destructures the fixtures it uses. */
export interface LiveFixtureUse {
  callback: (...args: never[]) => unknown
  /** 0 in general, 1 for an `aroundEach` hook and a `for` body. */
  index: number
}

// esbuild's lowered async functions, which Vitest strips the same way.
const LOWERED_ASYNC = /__async\((?:this|null), (?:null|arguments|\[[_0-9, ]*\]), function\*/
const LOWERED_ASYNC_HEAD = /__async\((?:this|null),/
const PARAMETERS = /[^(]*\(([^)]*)/
const POSITIONS = ['first', 'second']

/** The source without its comments, as Vitest's `filterOutComments` reads it. */
function withoutComments(source: string): string {
  const kept: string[] = []
  let state: 'none' | 'line' | 'block' = 'none'

  for (let i = 0; i < source.length; ++i) {
    if (state === 'line') {
      if (source[i] === '\n') {
        state = 'none'
      }
    } else if (state === 'block') {
      if (source[i - 1] === '*' && source[i] === '/') {
        state = 'none'
      }
    } else if (source[i] === '/' && source[i + 1] === '/') {
      state = 'line'
    } else if (source[i] === '/' && source[i + 1] === '*') {
      state = 'block'
      i += 2
    } else {
      kept.push(source[i])
    }
  }

  return kept.join('')
}

/** Splits on the commas outside `{}` and `[]`, as Vitest's `splitByComma` does. */
function splitByComma(text: string): string[] {
  const parts: string[] = []
  const closers: string[] = []
  let start = 0

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      closers.push(text[i] === '{' ? '}' : ']')
    } else if (text[i] === closers.at(-1)) {
      closers.pop()
    } else if (closers.length === 0 && text[i] === ',') {
      const part = text.substring(start, i).trim()

      if (part) {
        parts.push(part)
      }

      start = i + 1
    }
  }

  const last = text.substring(start).trim()

  if (last) {
    parts.push(last)
  }

  return parts
}

/**
 * The fixture names a callback destructures, read from its source the way
 * Vitest's `getUsedProps` reads them. Throws when the parameter exists but
 * does not destructure, or uses a rest element, as Vitest does.
 */
export function liveFixtureProps({ callback, index }: LiveFixtureUse): Set<string> {
  let source = withoutComments(callback.toString())

  if (LOWERED_ASYNC.test(source)) {
    source = source.split(LOWERED_ASYNC_HEAD)[1]
  }

  const match = PARAMETERS.exec(source)

  if (!match) {
    return new Set()
  }

  const parameter = splitByComma(match[1])[index]

  if (!parameter) {
    return new Set()
  }

  if (!(parameter.startsWith('{') && parameter.endsWith('}'))) {
    throw new Error(
      `the ${POSITIONS[index] ?? `#${index + 1}`} parameter must destructure the fixtures it uses, such as ({ user }) => …, not "${parameter}"`,
    )
  }

  const props = splitByComma(parameter.slice(1, -1).replace(/\s/g, '')).map((prop) =>
    prop.replace(/:.*|=.*/g, ''),
  )

  const last = props.at(-1)

  if (last?.startsWith('...')) {
    throw new Error(`fixtures cannot be read with a rest element, got "${last}"`)
  }

  return new Set(props)
}
