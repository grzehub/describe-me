/** Attributes that name an element better than its text, in order of preference. */
const NAME_ATTRIBUTES = ['aria-label', 'name', 'placeholder', 'title']

function roleOf(element: Element): string {
  const explicit = element.getAttribute('role')

  if (explicit) {
    return explicit
  }

  const tag = element.tagName.toLowerCase()

  if (tag === 'input') {
    return element.getAttribute('type') ?? 'input'
  }

  return tag
}

function nameOf(element: Element): string {
  for (const attribute of NAME_ATTRIBUTES) {
    const value = element.getAttribute(attribute)

    if (value) {
      return value
    }
  }

  return (element.textContent ?? '').trim().slice(0, 40)
}

/**
 * A readable target for a frame label, e.g. `button "show details"`.
 * Testing Library hands interactions a real `Element` rather than a Vitest
 * locator, so the label is read off the element instead of a selector string.
 */
export function elementLabel(target: unknown): string | undefined {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return undefined
  }

  const name = nameOf(target)

  return name ? `${roleOf(target)} "${name}"` : roleOf(target)
}
