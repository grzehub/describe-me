import { el } from './el.js'

export interface Regions {
  header: HTMLElement
  sidebar: HTMLElement
  /** The sidebar's search field, above the tree. */
  search: HTMLInputElement
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
  const search = el('input', {
    class: 'sidebar-search',
    type: 'search',
    placeholder: 'Search tests  /',
    'aria-label': 'Search tests',
  })

  const tree = el('div', { class: 'tree' })
  const sidebar = el('aside', { class: 'sidebar' }, search, tree)
  const center = el('div', { class: 'center' })
  const inspector = el('aside', { class: 'inspector' })

  document
    .getElementById('app')!
    .replaceChildren(header, el('div', { class: 'body' }, sidebar, center, inspector))

  built = { header, sidebar, search, tree, center, inspector }

  return built
}
