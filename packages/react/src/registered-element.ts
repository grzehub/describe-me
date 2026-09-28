import { isValidElement, type ReactElement } from 'react'
import { describeComponentType } from '@describe-me/core'

const MAX_DEPTH = 6
const MAX_ELEMENTS = 200

/** How many elements the search has looked at, shared across its recursion. */
interface Budget {
  visited: number
}

/**
 * The first element inside `ui` whose component the plugin registered, or
 * null. Depth first through `children`, then the other element props. A
 * `fallback` is skipped, because `Suspense` shows it only while waiting.
 */
export function registeredElement(ui: ReactElement): ReactElement | null {
  return searchInside(ui, 1, { visited: 0 })
}

function searchInside(element: ReactElement, depth: number, budget: Budget): ReactElement | null {
  for (const held of heldElements(element)) {
    if (budget.visited >= MAX_ELEMENTS) {
      return null
    }

    budget.visited++

    if (describeComponentType(held.type).file !== undefined) {
      return held
    }

    const found = depth < MAX_DEPTH ? searchInside(held, depth + 1, budget) : null

    if (found) {
      return found
    }
  }

  return null
}

/** The elements in `children` first, then those in every other prop but `fallback`. */
function heldElements(element: ReactElement): ReactElement[] {
  const props = (element.props ?? {}) as Record<string, unknown>
  const held = elementsIn(props.children)

  for (const [key, value] of Object.entries(props)) {
    if (key !== 'children' && key !== 'fallback') {
      held.push(...elementsIn(value))
    }
  }

  return held
}

function elementsIn(value: unknown): ReactElement[] {
  if (isValidElement(value)) {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.flat(Infinity).filter((item) => isValidElement(item))
}
