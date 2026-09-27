import { inject } from 'vitest'
import { RUNTIME_OPTIONS_KEY, type RuntimeOptions } from './runtime-options.js'

/** Without the plugin nothing is provided, so a hand-wired setup keeps recording every test. */
export function readRuntimeOptions(): RuntimeOptions {
  return (
    (inject(RUNTIME_OPTIONS_KEY) as RuntimeOptions | undefined) ?? {
      include: [],
      exclude: [],
      renderFrame: 'eager',
    }
  )
}
