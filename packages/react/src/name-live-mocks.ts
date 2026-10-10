import { isValidElement } from 'react'

const MAX_DEPTH = 5
/** The name Vitest gives a mock that was never named. */
const UNNAMED = 'vi.fn()'

interface NamedMock {
  mockName(name: string): unknown
}

/** Duck typed, so it needs nothing from Vitest. */
function isUnnamedMock(value: unknown): value is NamedMock {
  if (typeof value !== 'function') {
    return false
  }

  const mock = value as { _isMockFunction?: unknown; getMockName?: unknown; mockName?: unknown }

  return (
    mock._isMockFunction === true &&
    typeof mock.getMockName === 'function' &&
    typeof mock.mockName === 'function' &&
    mock.getMockName() === UNNAMED
  )
}

/**
 * Names every unnamed mock in what a test rendered after the prop it is
 * passed as, so a click shows as `onSelect("Rename")`. Walks element props,
 * children and arrays, a few levels deep.
 */
export function nameLiveMocks(node: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      nameLiveMocks(item, depth + 1)
    }

    return
  }

  if (!isValidElement(node)) {
    return
  }

  for (const [prop, value] of Object.entries(node.props as Record<string, unknown>)) {
    if (isUnnamedMock(value)) {
      value.mockName(prop)
    } else {
      nameLiveMocks(value, depth + 1)
    }
  }
}
