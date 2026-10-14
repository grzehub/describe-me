import { inject } from 'vitest'
import { RUNTIME_OPTIONS_KEY, type RuntimeOptions } from './runtime-options.js'

const DEFAULTS: RuntimeOptions = {
  include: null,
  exclude: [],
  renderFrame: 'eager',
  stories: 'all',
}

/**
 * Without the plugin nothing is provided, so a hand-wired setup keeps recording
 * every test. The defaults also fill what an older plugin does not provide.
 */
export function readRuntimeOptions(): RuntimeOptions {
  const provided = inject(RUNTIME_OPTIONS_KEY) as Partial<RuntimeOptions> | undefined

  return { ...DEFAULTS, ...provided }
}
