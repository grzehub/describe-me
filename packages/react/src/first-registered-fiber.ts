import { isValidElement } from 'react'
import { describeComponentType } from '@describe-me/core'
import type { FiberLike } from './root-fiber.js'

const MAX_VISITED = 5000

/**
 * The first fiber whose component the plugin registered, depth first through
 * each start fiber and its descendants, or null. The siblings of a start
 * fiber and the subtrees of `Suspense` fallbacks are not searched.
 */
export function firstRegisteredFiber(starts: FiberLike[]): FiberLike | null {
  // React mounts a fallback inside a Fragment fiber whose `memoizedProps` is the fallback itself.
  const fallbacks = new Set<unknown>()
  let visited = 0

  for (const start of starts) {
    const pending: FiberLike[] = [start]

    while (pending.length > 0) {
      if (visited >= MAX_VISITED) {
        return null
      }

      visited++
      const fiber = pending.pop() as FiberLike

      if (fiber !== start && fiber.sibling) {
        pending.push(fiber.sibling)
      }

      if (fallbacks.has(fiber.memoizedProps)) {
        continue
      }

      if (isRegistered(fiber)) {
        return fiber
      }

      rememberFallback(fiber.memoizedProps, fallbacks)

      if (fiber.child) {
        pending.push(fiber.child)
      }
    }
  }

  return null
}

function isRegistered(fiber: FiberLike): boolean {
  return (
    describeComponentType(fiber.elementType).file !== undefined ||
    describeComponentType(fiber.type).file !== undefined
  )
}

/** Text fibers hold a string and the HostRoot holds null, so the shape is checked first. */
function rememberFallback(props: unknown, fallbacks: Set<unknown>): void {
  if (typeof props !== 'object' || props === null) {
    return
  }

  const { fallback } = props as { fallback?: unknown }

  if (typeof fallback !== 'object' || fallback === null) {
    return
  }

  fallbacks.add(fallback)

  if (isValidElement(fallback)) {
    fallbacks.add(fallback.props)
  }
}
