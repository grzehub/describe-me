/** Terse `createElement`: attributes, event listeners (by event name), children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      node.addEventListener(key, value)
    } else if (value === true) {
      node.setAttribute(key, '')
    } else if (value !== false) {
      node.setAttribute(key, value)
    }
  }

  for (const child of children) {
    if (child) {
      node.append(child)
    }
  }

  return node
}
