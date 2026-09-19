/** Terse `createElement`: attributes, event listeners (by event name), children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k, v)
    else if (v === true) el.setAttribute(k, '')
    else if (v !== false) el.setAttribute(k, v)
  }
  for (const c of children) if (c) el.append(c)
  return el
}
