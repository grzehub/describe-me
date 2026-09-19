/**
 * Playwright's internal selector, e.g.
 * `internal:testid=[data-testid="__vitest_0__"s] >> internal:role=button[name="increment"i]`
 * becomes `button "increment"`.
 */
export function prettySelector(selector: string): string {
  const last =
    selector
      .split('>>')
      .map((part) => part.trim())
      .filter((part) => !part.startsWith('internal:testid'))
      .pop() ?? selector

  const match = /^internal:(\w+)=(.*)$/.exec(last)
  if (!match) {
    return last
  }

  const [, kind, rest] = match
  const name = /\[name=("[^"]*")[si]?\]/.exec(rest)?.[1]
  const base = rest.replace(/\[.*$/, '').replace(/[si]$/, '')
  if (kind === 'role') {
    return name ? `${base} ${name}` : base
  }

  if (
    kind === 'text' ||
    kind === 'label' ||
    kind === 'placeholder' ||
    kind === 'alt' ||
    kind === 'title'
  ) {
    return `${kind} ${base}`
  }

  return last
}
