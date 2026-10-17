import { el } from './el.js'
import { SidebarWidth } from './sidebar-width.js'
import { renderThemeSwitch } from './theme-switch.js'

export interface Regions {
  /** The wordmark, counts, issues and run time in the header, which repaints fill. */
  headerInfo: HTMLElement
  /** The version warning under the header, hidden unless the data comes from another release line. */
  banner: HTMLElement
  sidebar: HTMLElement
  /** The sidebar's search field, above the tree. */
  search: HTMLInputElement
  /** The tag the tree is narrowed to, between the search and the tree. Hidden without one. */
  tagFilter: HTMLElement
  /** The sidebar's module blocks go here. */
  tree: HTMLElement
  /** The separator on the sidebar's right edge that sets its width. */
  sidebarHandle: HTMLElement
  center: HTMLElement
  inspector: HTMLElement
  /** The grid of sidebar, handle, center and inspector, which holds `--sidebar-width`. */
  columns: HTMLElement
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

  const headerInfo = el('div', { class: 'header-info' })
  const header = el('header', { class: 'header' }, headerInfo, renderThemeSwitch())
  const banner = el('div', { class: 'version-banner', role: 'status', hidden: true })
  const search = el('input', {
    class: 'sidebar-search',
    type: 'search',
    placeholder: 'Search tests  /',
    'aria-label': 'Search tests',
  })

  const tagFilter = el('div', { class: 'tag-filter', role: 'status', hidden: true })
  const tree = el('div', { class: 'tree' })
  const sidebar = el('aside', { class: 'sidebar' }, search, tagFilter, tree)
  // Outside the sidebar, which scrolls, so the handle stays put while the tree moves.
  const sidebarHandle = el('div', {
    class: 'sidebar-handle',
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': 'Sidebar width',
    'aria-valuemin': String(SidebarWidth.MIN),
    tabindex: '0',
    title: 'Drag to resize. Double-click to reset.',
  })

  const center = el('div', { class: 'center' })
  const inspector = el('aside', { class: 'inspector' })
  const columns = el('div', { class: 'body' }, sidebar, sidebarHandle, center, inspector)

  document.getElementById('app')!.replaceChildren(header, banner, columns)

  built = {
    headerInfo,
    banner,
    sidebar,
    search,
    tagFilter,
    tree,
    sidebarHandle,
    center,
    inspector,
    columns,
  }

  return built
}
