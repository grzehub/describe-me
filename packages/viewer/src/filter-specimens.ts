/**
 * Show only the specimens of the tokens in `shown`, or all of them for
 * `null`, in place. Palette rows, scale rows and blocks follow their tokens,
 * and each block's count says how many it shows.
 */
export function filterSpecimens(root: Element, shown: ReadonlySet<string> | null): void {
  const hides = (name: string | undefined): boolean => shown !== null && !shown.has(name ?? '')

  for (const element of root.querySelectorAll<HTMLElement>('[data-token]')) {
    element.hidden = hides(element.dataset.token)
  }

  for (const row of root.querySelectorAll<HTMLElement>('[data-base]')) {
    row.hidden = hides(row.dataset.base)
  }

  for (const row of root.querySelectorAll<HTMLElement>('.fd-prow')) {
    row.hidden = row.querySelector('[data-token]:not([hidden])') === null
  }

  for (const block of root.querySelectorAll<HTMLElement>('.fd-block')) {
    const count = block.querySelectorAll('[data-token]:not([hidden])').length
    const label = block.querySelector('.fd-count')
    block.hidden = count === 0

    if (label) {
      label.textContent = String(count)
    }
  }
}
