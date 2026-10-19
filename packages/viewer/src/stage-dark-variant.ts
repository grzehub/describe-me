import type { DarkVariantRoot } from '@describe-me/core/types'
import type { Canvas } from './canvas-of.js'
import { foundationsModelOf } from './foundations-model-of.js'
import { loadFoundations } from './load-foundations.js'
import { state } from './state.js'

/**
 * Kept while the load of a new manifest is in flight, so a manifest reload
 * neither strips nor adds the class back.
 */
let lastKnown: DarkVariantRoot | null = null

function rootOf(variant: DarkVariantRoot | null): DarkVariantRoot | null {
  if (!variant?.className && !variant?.attribute) {
    return null
  }

  const root: DarkVariantRoot = {}

  if (variant.className) {
    root.className = variant.className
  }

  if (variant.attribute) {
    root.attribute = { name: variant.attribute.name, value: variant.attribute.value }
  }

  return root
}

/**
 * The class and attribute that the stage puts on the root of a frame on
 * `canvas`: the dark variant that Foundations detects, on the dark canvas
 * only, which `bg=dark` and an `auto` that resolves to dark both give.
 * Without tokens there is nothing to read it from, so nothing is fetched and
 * it is `null`. Starts the lazy load of `foundations.json`, and is `null`
 * until the first one is in.
 */
export function stageDarkVariant(canvas: Canvas): DarkVariantRoot | null {
  if (canvas !== 'dark' || (state.manifest?.foundations?.tokens ?? 0) <= 0) {
    return null
  }

  const load = loadFoundations()

  if (load.status === 'loading') {
    return lastKnown
  }

  lastKnown = load.status === 'ready' ? rootOf(foundationsModelOf(load).darkVariant) : null

  return lastKnown
}
