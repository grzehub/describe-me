/**
 * Travels from the plugin to the setup files through Vitest's `provide` /
 * `inject`. Keep it plain JSON: the browser receives it serialized, so a
 * RegExp would not survive. The test runtime imports this file, so it imports
 * nothing itself.
 */

export interface CompiledGlob {
  source: string
  flags: string
}

export interface RuntimeOptions {
  /** Empty means every test file. */
  include: CompiledGlob[]
  /** Wins over `include`. */
  exclude: CompiledGlob[]
}

export const RUNTIME_OPTIONS_KEY = 'describe-me' as const

// `ProvidedContext` is empty, so `inject` and `test.provide` only type-check
// once the key is declared.
declare module 'vitest' {
  interface ProvidedContext {
    'describe-me': RuntimeOptions
  }
}
