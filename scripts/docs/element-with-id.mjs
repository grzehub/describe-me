import { startTags } from './start-tags.mjs'

/**
 * The inner HTML of the element whose `id` is `id`, as written, or `null` when
 * the page has no such element or it is never closed. Nested elements of the
 * same name are counted, so a `div` that holds another `div` ends at its own
 * end tag.
 */
export function elementWithId(html, id) {
  const start = startTags(html).find((tag) => tag.attributes.id === id)

  if (!start) {
    return null
  }

  const end = endTagOf(html, start.name, start.end)

  return end < 0 ? null : html.slice(start.end, end)
}

/** Where the end tag of the element whose start tag ends at `from` begins, or -1. */
function endTagOf(html, tag, from) {
  const boundary = new RegExp(`<(/?)${tag}(?=[\\s/>])`, 'gi')
  boundary.lastIndex = from
  let depth = 1

  for (let match = boundary.exec(html); match; match = boundary.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) {
      return match.index
    }
  }

  return -1
}
