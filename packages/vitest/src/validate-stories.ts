import { inspect } from 'node:util'
import type { StoriesMode } from './stories-mode.js'

/** The plugin's `stories`, checked before any test runs. */
export function validateStories(value: unknown): StoriesMode {
  if (value === undefined) {
    return 'all'
  }

  if (value === 'all' || value === 'tagged') {
    return value
  }

  throw new Error(`describe-me: stories expects 'all' or 'tagged', got ${inspect(value)}`)
}
