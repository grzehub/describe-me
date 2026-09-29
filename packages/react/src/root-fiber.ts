/**
 * The fields of a React fiber the naming lookup reads. Structural, because
 * React does not export its fiber type.
 */
export interface FiberLike {
  elementType?: unknown
  type?: unknown
  memoizedProps?: unknown
  child?: FiberLike | null
  sibling?: FiberLike | null
  stateNode?: unknown
}

// React appends a random suffix, one per copy of React on the page.
const CONTAINER_KEY_PREFIX = '__reactContainer$'

/**
 * The current HostRoot fiber of the React root mounted into `container`, or
 * null when there is none.
 */
export function rootFiber(container: Element | DocumentFragment): FiberLike | null {
  const key = Object.keys(container).find((name) => name.startsWith(CONTAINER_KEY_PREFIX))

  if (key === undefined) {
    return null
  }

  const stored = (container as unknown as Record<string, FiberLike | null>)[key]
  // The fiber on the container can be the stale alternate. Its FiberRoot knows the current one.
  const fiberRoot = stored?.stateNode as { current?: FiberLike | null } | null | undefined

  return fiberRoot?.current ?? null
}
