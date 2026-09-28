import type { ReactElement } from 'react'
import {
  describeComponentType,
  EXPORT_REGISTRY_KEY,
  serializeValue,
  type ComponentInfo,
} from '@describe-me/core'
import { describeElement } from './describe-element.js'
import { firstRegisteredFiber } from './first-registered-fiber.js'
import { registeredElement } from './registered-element.js'
import { rootFiber, type FiberLike } from './root-fiber.js'
import { subjectFibers } from './subject-fibers.js'

/**
 * Describe what a test rendered: `ui` when the plugin registered its
 * component, otherwise the first registered component inside it, with the
 * props that component received. Falls back to `ui` when nothing is found or
 * React's internals look different. Synchronous and bounded.
 */
export function describeRendered(
  ui: ReactElement,
  container: Element | DocumentFragment,
  hasWrapper: boolean,
): ComponentInfo {
  try {
    return lookUp(ui, container, hasWrapper) ?? describeElement(ui)
  } catch {
    return describeElement(ui)
  }
}

/** The component to name the test after, or null to keep `ui`. */
function lookUp(
  ui: ReactElement,
  container: Element | DocumentFragment,
  hasWrapper: boolean,
): ComponentInfo | null {
  // Without a registry, as with `registerExports: false`, nothing can be found.
  if (describeComponentType(ui.type).file !== undefined || !hasRegistry()) {
    return null
  }

  const element = registeredElement(ui)

  if (element) {
    return describeElement(element)
  }

  const root = rootFiber(container)

  if (root === null) {
    return null
  }

  const subjects = subjectFibers(root, ui)
  // With a wrapper, the root also holds the wrapper's own components.
  const starts = subjects.length === 0 && !hasWrapper ? [root] : subjects
  const fiber = firstRegisteredFiber(starts)

  return fiber === null ? null : describeFiber(fiber)
}

function hasRegistry(): boolean {
  const scope = globalThis as Record<symbol, unknown>

  return scope[Symbol.for(EXPORT_REGISTRY_KEY)] !== undefined
}

function describeFiber(fiber: FiberLike): ComponentInfo {
  const byElementType = describeComponentType(fiber.elementType)
  const identity =
    byElementType.file === undefined ? describeComponentType(fiber.type) : byElementType

  const props = serializeValue(fiber.memoizedProps ?? {}) as Record<string, unknown>

  return { ...identity, props }
}
