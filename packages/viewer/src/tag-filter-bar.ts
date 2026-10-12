import { el } from './el.js'
import { filterByTag, state } from './state.js'

/** The line above the tree while a tag narrows it, with the button that clears the filter. */
export function tagFilterBar(): HTMLElement[] {
  if (state.tag === null) {
    return []
  }

  return [
    el('span', { class: 'tag-filter-label' }, 'tagged'),
    el('span', { class: 'tag' }, state.tag),
    el(
      'button',
      {
        class: 'tag-filter-clear',
        'aria-label': `Show every test, not only those tagged ${state.tag}`,
        title: 'show every test',
        click: () => filterByTag(null),
      },
      '×',
    ),
  ]
}
