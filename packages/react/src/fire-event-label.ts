import { elementLabel } from '@describe-me/core'

/** The parts of a `fireEvent` init that say what was typed or pressed. */
interface InitFields {
  target?: { value?: unknown } | null
  key?: unknown
}

/**
 * The frame label of one `fireEvent` call, e.g. `click(button "Save")`,
 * `change(text "Name", "hello")` or `scroll()` for a target that is not an
 * element, such as `window`.
 */
export function fireEventLabel(eventName: string, target: unknown, init?: unknown): string {
  const parts: string[] = []
  const element = elementLabel(target)

  if (element) {
    parts.push(element)
  }

  const { target: initTarget, key } = (init ?? {}) as InitFields
  const value = initTarget?.value

  if (typeof value === 'string') {
    parts.push(JSON.stringify(value))
  }

  if (typeof key === 'string') {
    parts.push(JSON.stringify(key))
  }

  return `${eventName}(${parts.join(', ')})`
}
