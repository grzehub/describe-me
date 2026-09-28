import { el } from './el.js'

export interface Regions {
  header: HTMLElement
  sidebar: HTMLElement
  /** The sidebar's module blocks go here. */
  tree: HTMLElement
  center: HTMLElement
  inspector: HTMLElement
}

let built: Regions | null = null

/**
 * The persistent layout inside `#app`, built on the first call. Repaints fill
 * these regions in place, so their scroll positions survive.
 */
export function regions(): Regions {
  if (built) {
    return built
  }

  const header = el('header', { class: 'header' })
  const tree = el('div', { class: 'tree' })
  const sidebar = el('aside', { class: 'sidebar' }, tree)
  const center = el('div', { class: 'center' })
  const inspector = el('aside', { class: 'inspector' })

  document
    .getElementById('app')!
    .replaceChildren(header, el('div', { class: 'body' }, sidebar, center, inspector))

  built = { header, sidebar, tree, center, inspector }

  return built
}
