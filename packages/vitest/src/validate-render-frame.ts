import { inspect } from 'node:util'
import type { RenderFrameMode } from '@describe-me/core/types'

type PendingMode = Extract<RenderFrameMode, object>

const ACCEPTED =
  "'eager', 'lazy' or { pending: string, timeout?: number } with a non-empty selector and a timeout above 0 ms"

function isPendingMode(value: unknown): value is PendingMode {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const { pending, timeout, ...rest } = value as Record<string, unknown>

  if (Object.keys(rest).length > 0 || typeof pending !== 'string' || pending === '') {
    return false
  }

  return (
    timeout === undefined ||
    (typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0)
  )
}

/**
 * The plugin's `renderFrame`, checked before any test runs. Selector syntax is
 * left to `recorder.configure()` in the test runtime, which has a DOM to parse it.
 */
export function validateRenderFrame(value: unknown): RenderFrameMode {
  if (value === undefined) {
    return 'eager'
  }

  if (value === 'eager' || value === 'lazy' || isPendingMode(value)) {
    return value
  }

  throw new Error(`describe-me: renderFrame expects ${ACCEPTED}, got ${inspect(value)}`)
}
