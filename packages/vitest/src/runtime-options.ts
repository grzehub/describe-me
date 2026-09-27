/**
 * What the plugin hands from the Vite config (Node) to the setup files in the
 * test runtime (a jsdom worker or the browser iframe), through Vitest's
 * `provide` / `inject`. Plain JSON only: the browser receives it serialized, so
 * a RegExp would not survive the trip. Browser-safe, imports nothing.
 */

/** A glob compiled to a RegExp, kept as the two strings that rebuild it. */
export interface CompiledGlob {
  source: string
  flags: string
}

/** The plugin options the test runtime needs. */
export interface RuntimeOptions {
  /** Test files to record; empty means every test file. */
  include: CompiledGlob[]
  /** Test files never to record; wins over `include`. */
  exclude: CompiledGlob[]
}

/** The `provide` / `inject` key the runtime options travel under. */
export const RUNTIME_OPTIONS_KEY = 'describe-me' as const

declare module 'vitest' {
  interface ProvidedContext {
    'describe-me': RuntimeOptions
  }
}
