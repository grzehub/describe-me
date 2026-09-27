import { inject } from 'vitest'
import { RUNTIME_OPTIONS_KEY, type RuntimeOptions } from './runtime-options.js'

/**
 * The runtime options the plugin provided. A setup file wired by hand,
 * without the plugin, gets none and keeps recording every test.
 */
export function readRuntimeOptions(): RuntimeOptions {
  return (inject(RUNTIME_OPTIONS_KEY) as RuntimeOptions | undefined) ?? { include: [], exclude: [] }
}
