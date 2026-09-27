import { inspect } from 'node:util'
import picomatch from 'picomatch'
import type { CompiledGlob } from './runtime-options.js'

/**
 * Compile the `include` / `exclude` globs once, in Node, into plain
 * `{ source, flags }` pairs that can travel to the test runtime. Invalid input
 * fails here, with a `describe-me:` message, before any test runs.
 */
export function compileGlobs(patterns: string | string[] | undefined): CompiledGlob[] {
  if (patterns === undefined) {
    return []
  }

  const list: unknown[] = Array.isArray(patterns) ? patterns : [patterns]

  return list.map((pattern) => {
    // picomatch throws its own unprefixed TypeError for an empty string.
    if (typeof pattern !== 'string' || pattern === '') {
      throw new Error(
        `describe-me: include and exclude expect non-empty glob strings, got ${inspect(pattern)}`,
      )
    }

    const regExp = picomatch.makeRe(pattern, { dot: true, windows: false })

    return { source: regExp.source, flags: regExp.flags }
  })
}
