import { startTags } from './start-tags.mjs'

// The parts every page shares, plus the two a page owns: `main` and the "On this page" list.
const PARTS = {
  topbar: { tag: 'header', className: 'topbar' },
  sidebar: { tag: 'nav', className: 'sidebar' },
  main: { tag: 'main', className: 'page' },
  pager: { tag: 'nav', className: 'pager' },
  footer: { tag: 'footer', className: 'page-foot' },
  toc: { tag: 'aside', className: 'toc' },
}

/**
 * One part of a page as written, from its start tag to its end tag: `topbar`,
 * `sidebar`, `main`, `pager`, `footer` or `toc`. `null` when the page lacks it.
 */
export function pagePart(html, part) {
  const { tag, className } = PARTS[part]
  const start = startTags(html).find(
    (candidate) =>
      candidate.name === tag && (candidate.attributes.class ?? '').split(/\s+/).includes(className),
  )

  if (!start) {
    return null
  }

  const end = endOf(html, tag, start.end)

  return end < 0 ? null : html.slice(start.index, end)
}

/** Where the element whose start tag ends at `from` ends, counting nested elements of the same name. */
function endOf(html, tag, from) {
  const boundary = new RegExp(`<(/?)${tag}(?=[\\s/>])`, 'gi')
  boundary.lastIndex = from
  let depth = 1

  for (let match = boundary.exec(html); match; match = boundary.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) {
      return html.indexOf('>', match.index) + 1
    }
  }

  return -1
}
