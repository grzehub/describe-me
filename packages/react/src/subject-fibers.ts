import { Fragment, isValidElement, type ReactElement } from 'react'
import type { FiberLike } from './root-fiber.js'

const MAX_VISITED = 5000

/**
 * The fibers React mounted for `ui` itself, where the naming lookup starts,
 * so a wrapper's own components are never searched. Empty when none can be
 * told apart.
 */
export function subjectFibers(root: FiberLike, ui: ReactElement): FiberLike[] {
  const subjectProps = propsOfSubject(ui)
  const byProps = fibersMatching(root, (fiber) => subjectProps.has(fiber.memoizedProps))

  // Every `div` or fragment would share a host or symbol type, so only component types count.
  if (byProps.length > 0 || !isComponentType(ui.type)) {
    return byProps
  }

  return fibersMatching(root, (fiber) => fiber.elementType === ui.type)
}

/**
 * The props objects the fibers of `ui` hold. A fragment's own fiber holds its
 * children or does not exist, so its direct element children stand in for it.
 */
function propsOfSubject(ui: ReactElement): Set<unknown> {
  if (ui.type !== Fragment) {
    return new Set([ui.props])
  }

  const { children } = ui.props as { children?: unknown }
  const items = Array.isArray(children) ? children.flat(Infinity) : [children]

  return new Set(items.filter((item) => isValidElement(item)).map((element) => element.props))
}

/** Depth first from `root`, without descending into a fiber that matches. */
function fibersMatching(root: FiberLike, matches: (fiber: FiberLike) => boolean): FiberLike[] {
  const found: FiberLike[] = []
  const pending: FiberLike[] = [root]

  for (let visited = 0; visited < MAX_VISITED && pending.length > 0; visited++) {
    const fiber = pending.pop() as FiberLike

    if (fiber.sibling) {
      pending.push(fiber.sibling)
    }

    if (matches(fiber)) {
      found.push(fiber)
      continue
    }

    if (fiber.child) {
      pending.push(fiber.child)
    }
  }

  return found
}

/** Components, `memo`, `forwardRef`, `lazy` and contexts. */
function isComponentType(type: unknown): boolean {
  return typeof type === 'function' || (typeof type === 'object' && type !== null)
}
