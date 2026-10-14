import type { ManifestTest } from '@describe-me/core/types'
import { el } from './el.js'
import { shownTags } from './shown-tags.js'
import { filterByTag, state } from './state.js'

/** The test's tags in the inspector. One narrows the sidebar to its tests, and again shows all. */
export function tagButtons(test: ManifestTest): HTMLElement | null {
  const tags = shownTags(test)

  if (tags.length === 0) {
    return null
  }

  const buttons = tags.map((tag) => {
    const active = tag === state.tag

    return el(
      'button',
      {
        class: `tag${active ? ' active' : ''}`,
        'aria-pressed': String(active),
        title: active ? 'show every test' : `show only the tests tagged ${tag}`,
        click: () => filterByTag(active ? null : tag),
      },
      tag,
    )
  })

  return el('div', { class: 'tags' }, ...buttons)
}
