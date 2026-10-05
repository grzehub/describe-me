import { compileGlobs } from './compile-globs.js'
import type { CompiledGlob } from './runtime-options.js'

/** Keeps an omitted `include` (`null`, every test file) apart from an empty list (no test file). */
export function compileInclude(patterns: string | string[] | undefined): CompiledGlob[] | null {
  if (patterns === undefined) {
    return null
  }

  return compileGlobs(patterns)
}
