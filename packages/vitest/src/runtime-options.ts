/**
 * Travels from the plugin to the setup files through Vitest's `provide` /
 * `inject`. Keep it plain JSON: the browser receives it serialized, so a
 * RegExp would not survive. The test runtime imports this file, so it imports
 * only types.
 */

import type { RenderFrameMode } from '@describe-me/core/types'

export interface CompiledGlob {
  source: string
  flags: string
}

export interface RuntimeOptions {
  /** Empty means every test file. */
  include: CompiledGlob[]
  /** Wins over `include`. */
  exclude: CompiledGlob[]
  renderFrame: RenderFrameMode
}

export const RUNTIME_OPTIONS_KEY = 'describe-me' as const

// `ProvidedContext` is empty, so `inject` and `test.provide` only type-check
// once the key is declared.
declare module 'vitest' {
  interface ProvidedContext {
    'describe-me': RuntimeOptions
  }
}
