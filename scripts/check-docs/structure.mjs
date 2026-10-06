import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const DOCS_URL = 'https://github.com/grzehub/describe-me/blob/main/docs/'
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const ANCHOR_LABEL = 'Link to this section'
const FORBIDDEN_ELEMENTS = ['script', 'style', 'iframe']

/**
 * The skeleton every page shares: the file list, the head, the topbar, the
 * sidebar, the pager and the footer, the section headings and their "On this
 * page" list, unique ids and no stub markers. No scripts, no inline styles,
 * and only relative URLs for the site's own files.
 */
export default function structure(context) {
  const problems = [...pageFiles(context), ...packageVersions(context)]
  const present = context.pages.filter((page) => context.html.has(page.file))

  for (const page of present) {
    const html = context.html.get(page.file)

    problems.push(
      ...head(page, html, context),
      ...forbidden(page, html, context),
      ...urls(page, html, context),
      ...headings(page, html, context),
      ...uniqueIds(page, html, context),
      ...stubMarkers(page, html, context),
    )
  }

  problems.push(
    ...topbars(present, context),
    ...sidebars(present, context),
    ...pagers(present, context),
    ...footers(present, context),
  )

  return problems
}

function pageFiles(context) {
  const expected = context.pages.map((page) => page.file)
  const actual = readdirSync(join(context.root, 'docs')).filter((file) => file.endsWith('.html'))

  return [
    ...expected
      .filter((file) => !actual.includes(file))
      .map((file) => `${file}: missing, scripts/docs/pages.mjs lists it`),
    ...actual
      .filter((file) => !expected.includes(file))
      .map((file) => `${file}: not in scripts/docs/pages.mjs`),
  ]
}

function viewerVersion(context) {
  return context.packages.find((pkg) => pkg.name === 'describe-me').json.version
}

function packageVersions(context) {
  const version = viewerVersion(context)

  return context.packages
    .filter((pkg) => pkg.json.version !== version)
    .map(
      (pkg) =>
        `${pkg.dir}/package.json is at ${pkg.json.version}, packages/viewer/package.json at ${version}. The topbar shows one version for all four packages`,
    )
}

function head(page, html, context) {
  const problems = []
  const tags = context.helpers.startTags(html)
  const find = (name, attributes) =>
    tags.find(
      (tag) =>
        tag.name === name &&
        Object.entries(attributes).every(([key, value]) => tag.attributes[key] === value),
    )

  if (!html.startsWith('<!doctype html>')) {
    problems.push(`${page.file}: does not start with <!doctype html>`)
  }

  if (!find('html', { lang: 'en' })) {
    problems.push(`${page.file}: has no <html lang="en">`)
  }

  const title = html.match(/<title>([\s\S]*?)<\/title>/)
  const expectedTitle = `${page.title} · describe-me docs`

  if (!title || collapse(title[1]) !== expectedTitle) {
    problems.push(`${page.file}: the <title> must be "${expectedTitle}"`)
  }

  const description = find('meta', { name: 'description' })

  if (!description || !(description.attributes.content ?? '').trim()) {
    problems.push(`${page.file}: has no <meta name="description"> with content`)
  }

  if (!find('link', { rel: 'icon', href: 'favicon.svg' })) {
    problems.push(`${page.file}: has no <link rel="icon" href="favicon.svg" />`)
  }

  if (!find('link', { rel: 'stylesheet', href: 'docs.css' })) {
    problems.push(`${page.file}: has no <link rel="stylesheet" href="docs.css" />`)
  }

  return problems
}

function forbidden(page, html, context) {
  const problems = []

  for (const tag of context.helpers.startTags(html)) {
    if (FORBIDDEN_ELEMENTS.includes(tag.name)) {
      problems.push(
        `${page.file}: has a <${tag.name}> element. The docs are plain HTML and docs.css`,
      )
    }

    if ('style' in tag.attributes) {
      problems.push(`${page.file}: <${tag.name}> has a style attribute. Use a class of docs.css`)
    }

    const handlers = Object.keys(tag.attributes).filter((name) => /^on[a-z]+$/.test(name))

    for (const handler of handlers) {
      problems.push(`${page.file}: <${tag.name}> has an inline event handler ${handler}`)
    }
  }

  return problems
}

function urls(page, html, context) {
  const problems = []

  for (const tag of context.helpers.startTags(html)) {
    const { src, href } = tag.attributes

    if (src !== undefined && !isRelative(src)) {
      problems.push(`${page.file}: <${tag.name} src="${src}"> must be a relative URL`)
    }

    if (href === undefined) {
      continue
    }

    if (tag.name === 'link' && !isRelative(href)) {
      problems.push(`${page.file}: <link href="${href}"> must be a relative URL`)

      continue
    }

    if (href.startsWith('/') || href.startsWith('../') || /^http:/i.test(href)) {
      problems.push(
        `${page.file}: href="${href}" must be relative to docs/ or an https: link, the site may live under a sub-path`,
      )

      continue
    }

    if (URL_SCHEME.test(href) && !/^(?:https|mailto):/i.test(href)) {
      problems.push(`${page.file}: href="${href}": external links use https: or mailto:`)
    }
  }

  return problems
}

function isRelative(url) {
  return !URL_SCHEME.test(url) && !url.startsWith('/')
}

/** The `h2` of the page's `main`, each with its id and the anchor link of the template. */
function headings(page, html, context) {
  const problems = []
  const main = context.helpers.pagePart(html, 'main')

  if (main === null) {
    return [`${page.file}: has no <main class="page">`]
  }

  const ids = []

  for (const heading of sectionHeadings(main, context)) {
    const id = heading.attributes.id

    if (!id) {
      problems.push(`${page.file}: an <h2> has no id ("${collapse(heading.inner).slice(0, 40)}")`)

      continue
    }

    ids.push(id)

    const anchors = context.helpers
      .anchorsIn(heading.inner)
      .filter((anchor) => anchor.attributes.class === 'anchor')

    const fine =
      anchors.length === 1 &&
      anchors[0].attributes.href === `#${id}` &&
      anchors[0].attributes['aria-label'] === ANCHOR_LABEL &&
      collapse(anchors[0].inner) === '#'

    if (!fine) {
      problems.push(
        `${page.file}: <h2 id="${id}"> needs exactly one <a class="anchor" href="#${id}" aria-label="${ANCHOR_LABEL}">#</a>`,
      )
    }
  }

  for (const id of context.sections[page.file] ?? []) {
    if (!ids.includes(id)) {
      problems.push(
        `${page.file}: has no <h2 id="${id}">, which scripts/docs/sections.mjs promises`,
      )
    }
  }

  return [...problems, ...tableOfContents(page, html, ids, context)]
}

function sectionHeadings(main, context) {
  return context.helpers
    .startTags(main)
    .filter((tag) => tag.name === 'h2')
    .map((tag) => {
      const close = main.indexOf('</h2', tag.end)

      return {
        attributes: tag.attributes,
        inner: main.slice(tag.end, close < 0 ? main.length : close),
      }
    })
}

function tableOfContents(page, html, ids, context) {
  const toc = context.helpers.pagePart(html, 'toc')

  if (toc === null) {
    return [`${page.file}: has no <aside class="toc"> ("On this page")`]
  }

  const linked = context.helpers.anchorsIn(toc).map((anchor) => anchor.attributes.href)
  const expected = ids.map((id) => `#${id}`)
  const index = firstMismatch(linked, expected)

  if (index < 0) {
    return []
  }

  return [
    `${page.file}: "On this page" link ${index + 1} is ${linked[index] ?? 'missing'}, the h2 ids give ${expected[index] ?? 'none'}. It lists every h2 in order`,
  ]
}

function uniqueIds(page, html, context) {
  const counts = new Map()

  for (const id of context.helpers.idsIn(html)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${page.file}: the id "${id}" appears ${count} times`)
}

function stubMarkers(page, html, context) {
  const problems = []

  for (const tag of context.helpers.startTags(html)) {
    if ('data-stub' in tag.attributes) {
      problems.push(
        `${page.file}: <${tag.name}> has data-stub. The site is complete, so no page is a stub`,
      )
    }

    if (classes(tag).includes('stub')) {
      problems.push(`${page.file}: <${tag.name}> has the class stub`)
    }
  }

  return problems
}

function classes(tag) {
  return (tag.attributes.class ?? '').split(/\s+/).filter(Boolean)
}

function topbars(present, context) {
  const problems = []
  const version = viewerVersion(context)
  const shapes = new Map()

  for (const page of present) {
    const topbar = context.helpers.pagePart(context.html.get(page.file), 'topbar')

    if (topbar === null) {
      problems.push(`${page.file}: has no <header class="topbar">`)

      continue
    }

    const shown = topbar.match(context.helpers.versionSpan)

    if (!shown || shown[1] !== version) {
      problems.push(
        `${page.file}: the topbar shows ${shown ? `v${shown[1]}` : 'no version'}, packages/viewer/package.json is at ${version}. Run node scripts/sync-docs-version.mjs`,
      )
    }

    // A wrong version is reported above, so it does not count as a different topbar too.
    const anyVersion = topbar.replace(context.helpers.versionSpan, '<span class="version">v</span>')
    shapes.set(page.file, collapse(anyVersion))
  }

  return [...problems, ...differences(shapes, 'topbar')]
}

function sidebars(present, context) {
  const problems = []
  const expected = expectedSidebar(context.pages)
  const shapes = new Map()

  for (const page of present) {
    const sidebar = context.helpers.pagePart(context.html.get(page.file), 'sidebar')

    if (sidebar === null) {
      problems.push(`${page.file}: has no <nav class="sidebar">`)

      continue
    }

    const entries = sidebarEntries(sidebar, context)
    const index = firstMismatch(entries, expected)

    if (index >= 0) {
      problems.push(
        `${page.file}: sidebar entry ${index + 1} is "${entries[index] ?? 'missing'}", scripts/docs/pages.mjs has "${expected[index] ?? 'nothing'}"`,
      )

      continue
    }

    const current = context.helpers
      .anchorsIn(sidebar)
      .filter((anchor) => 'aria-current' in anchor.attributes)

    if (current.length !== 1 || current[0].attributes.href !== page.file) {
      problems.push(
        `${page.file}: aria-current="page" must mark this page's sidebar link, and only it`,
      )
    } else if (current[0].attributes['aria-current'] !== 'page') {
      problems.push(`${page.file}: the sidebar link of this page needs aria-current="page"`)
    }

    shapes.set(page.file, collapse(sidebar.replace(/\s+aria-current="page"/g, '')))
  }

  return [...problems, ...differences(shapes, 'sidebar')]
}

/** The sidebar as a list of `Group:` headings and `file Title` links, in order. */
function expectedSidebar(pages) {
  const entries = []

  for (const [index, page] of pages.entries()) {
    if (index === 0 || pages[index - 1].group !== page.group) {
      entries.push(`${page.group}:`)
    }

    entries.push(`${page.file} ${page.title}`)
  }

  return entries
}

function sidebarEntries(sidebar, context) {
  const entries = []
  const tags = context.helpers.startTags(sidebar)

  for (const tag of tags) {
    if (tag.name === 'p' && classes(tag).includes('group')) {
      const close = sidebar.indexOf('</p', tag.end)
      entries.push(`${collapse(context.helpers.stripTags(sidebar.slice(tag.end, close)))}:`)
    }

    if (tag.name === 'a') {
      const close = sidebar.indexOf('</a', tag.end)
      const title = collapse(context.helpers.stripTags(sidebar.slice(tag.end, close)))
      entries.push(`${tag.attributes.href} ${title}`)
    }
  }

  return entries
}

function pagers(present, context) {
  const problems = []
  const order = context.pages

  for (const page of present) {
    const pager = context.helpers.pagePart(context.html.get(page.file), 'pager')

    if (pager === null) {
      problems.push(`${page.file}: has no <nav class="pager">`)

      continue
    }

    const index = order.findIndex((candidate) => candidate.file === page.file)
    const anchors = context.helpers.anchorsIn(pager)
    const expected = [
      { kind: 'prev', label: 'Previous', target: order[index - 1] },
      { kind: 'next', label: 'Next', target: order[index + 1] },
    ]

    for (const { kind, label, target } of expected) {
      const found = anchors.filter((anchor) => anchor.attributes.class === kind)

      if (!target) {
        if (found.length > 0) {
          problems.push(
            `${page.file}: the pager has a ${kind} link, but this page is the ${kind === 'prev' ? 'first' : 'last'}`,
          )
        }

        continue
      }

      const fine =
        found.length === 1 &&
        found[0].attributes.href === target.file &&
        collapse(found[0].inner) === `<span>${label}</span>${target.title}`

      if (!fine) {
        problems.push(
          `${page.file}: the pager needs <a class="${kind}" href="${target.file}"><span>${label}</span>${target.title}</a>`,
        )
      }
    }

    const strays = anchors.filter((anchor) => !['prev', 'next'].includes(anchor.attributes.class))

    if (strays.length > 0) {
      problems.push(`${page.file}: the pager holds only the prev and next links`)
    }
  }

  return problems
}

function footers(present, context) {
  const problems = []

  for (const page of present) {
    const footer = context.helpers.pagePart(context.html.get(page.file), 'footer')
    const expected = `${DOCS_URL}${page.file}`
    const hrefs =
      footer === null
        ? []
        : context.helpers.anchorsIn(footer).map((anchor) => anchor.attributes.href)

    if (!hrefs.includes(expected)) {
      problems.push(`${page.file}: the <footer class="page-foot"> must link to ${expected}`)
    }
  }

  return problems
}

/** Pages whose part differs from the one most pages share, with a hint where. */
function differences(shapes, part) {
  const counts = new Map()

  for (const shape of shapes.values()) {
    counts.set(shape, (counts.get(shape) ?? 0) + 1)
  }

  const [common] = [...counts].sort((left, right) => right[1] - left[1])[0] ?? []
  const reference = [...shapes].find(([, shape]) => shape === common)?.[0]

  return [...shapes]
    .filter(([, shape]) => shape !== common)
    .map(([file, shape]) => {
      const at = firstMismatch([...shape], [...common])
      const excerpt = (text) => `"${text.slice(Math.max(0, at - 20), at + 30)}"`

      return `${file}: the ${part} differs from the one on ${reference}: ${excerpt(shape)} where it has ${excerpt(common)}`
    })
}

/** The first index where two lists differ, or -1 when they are equal. */
function firstMismatch(actual, expected) {
  const length = Math.max(actual.length, expected.length)

  for (let i = 0; i < length; i++) {
    if (actual[i] !== expected[i]) {
      return i
    }
  }

  return -1
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim()
}
