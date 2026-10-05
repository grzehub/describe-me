const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const ASSETS = ['docs.css', 'favicon.svg']
const VIEWER_LINK = /^examples\/([^/]+)\/(?:index\.html)?$/
const BARE_VIEWER_LINK = /^examples\/([^/]+)$/
const URL_REFERENCE = /url\(\s*#([^)\s]+)\s*\)/g
const ID_LISTS = ['aria-labelledby', 'aria-describedby']
const DEEP_LINK_PARAMS = ['test', 'suite', 'frame', 'w', 'h']
const MAX_SIZE = 10_000
// A copy of MIN_FRAME_HEIGHT in packages/viewer/src/min-frame-height.ts.
const MIN_HEIGHT = 120

/**
 * Every relative link and image points at a page, docs.css, favicon.svg or one
 * of the example viewers, and every fragment at an id of its target. A page
 * that still has data-stub is a lenient target: its ids may not exist yet.
 * SVG references (`url(#…)`, `aria-labelledby`, `aria-describedby`) stay on
 * their page. A deep link into an example names a test, frame and suite of its
 * manifest and a viewport size the viewer accepts.
 */
export default function links(context) {
  const targets = targetsOf(context)
  const problems = []
  const missingManifests = new Set()

  for (const [file, html] of context.html) {
    const page = { file, ids: targets.get(file).ids, missingManifests }

    for (const tag of context.helpers.startTags(html)) {
      for (const name of ['href', 'src']) {
        if (tag.attributes[name] !== undefined) {
          const value = context.helpers.decodeEntities(tag.attributes[name])
          problems.push(...checkLink(page, value, targets, context))
        }
      }

      problems.push(...localReferences(page, tag))
    }
  }

  return problems
}

/** The ids of every page and whether it is still a stub. */
function targetsOf(context) {
  const targets = new Map()

  for (const [file, html] of context.html) {
    const tags = context.helpers.startTags(html)
    const stub = tags.some((tag) => tag.name === 'main' && 'data-stub' in tag.attributes)
    targets.set(file, { ids: new Set(context.helpers.idsIn(html)), stub })
  }

  return targets
}

function checkLink(page, value, targets, context) {
  if (URL_SCHEME.test(value) || value.startsWith('/')) {
    return []
  }

  const hashAt = value.indexOf('#')
  const path = hashAt < 0 ? value : value.slice(0, hashAt)
  const fragment = hashAt < 0 ? null : value.slice(hashAt + 1)
  const viewer = path.match(VIEWER_LINK)

  if (viewer && Object.hasOwn(context.manifests, viewer[1])) {
    return fragment ? checkDeepLink(page, value, viewer[1], fragment, context) : []
  }

  const bareViewer = path.match(BARE_VIEWER_LINK)

  if (bareViewer && Object.hasOwn(context.manifests, bareViewer[1])) {
    return [
      `${page.file}: ${value}: link to the viewer with a trailing slash, ${path}/, so its relative URLs resolve`,
    ]
  }

  if (ASSETS.includes(path)) {
    return []
  }

  const target = path === '' ? page.file : path

  if (!targets.has(target)) {
    return [
      `${page.file}: ${value} points at nothing in docs/ (a page, docs.css, favicon.svg or examples/<name>/)`,
    ]
  }

  if (fragment === null) {
    return []
  }

  if (fragment === '') {
    return [`${page.file}: ${value} has an empty fragment`]
  }

  const id = safeDecode(fragment)
  const { ids, stub } = targets.get(target)

  // A page a later PR writes may not have its ids yet. Links on the page itself stay strict.
  if (ids.has(id) || (stub && target !== page.file)) {
    return []
  }

  return [`${page.file}: ${value}: ${target} has no id "${id}"`]
}

/** `url(#…)` and the id lists of ARIA attributes, which only point within the page. */
function localReferences(page, tag) {
  const problems = []

  for (const value of Object.values(tag.attributes)) {
    for (const match of value.matchAll(URL_REFERENCE)) {
      if (!page.ids.has(match[1])) {
        problems.push(
          `${page.file}: <${tag.name}> refers to url(#${match[1]}), but no element has that id`,
        )
      }
    }
  }

  for (const name of ID_LISTS) {
    const ids = (tag.attributes[name] ?? '').split(/\s+/).filter(Boolean)

    for (const id of ids) {
      if (!page.ids.has(id)) {
        problems.push(
          `${page.file}: <${tag.name} ${name}="${tag.attributes[name]}">: no element has the id "${id}"`,
        )
      }
    }
  }

  return problems
}

function checkDeepLink(page, value, example, fragment, context) {
  const manifest = context.manifests[example]

  if (manifest === null) {
    const key = `${page.file} ${example}`

    if (page.missingManifests.has(key)) {
      return []
    }

    page.missingManifests.add(key)

    return [
      `${page.file}: links into examples/${example}/, but examples/${example}/.describe-me/manifest.json is missing. Run pnpm --filter ${example} test first`,
    ]
  }

  const params = new URLSearchParams(fragment)
  const problems = []
  const where = `${page.file}: ${value}`

  for (const key of new Set(params.keys())) {
    if (!DEEP_LINK_PARAMS.includes(key)) {
      problems.push(`${where}: the viewer reads only ${DEEP_LINK_PARAMS.join(', ')}, not "${key}"`)
    } else if (params.getAll(key).length > 1) {
      problems.push(`${where}: "${key}" appears more than once`)
    }
  }

  const tests = context.helpers.shownTests(manifest)

  problems.push(
    ...checkTest(where, example, params, tests),
    ...checkSuite(where, example, params, tests),
    ...checkSize(where, params, 'w', 1),
    ...checkSize(where, params, 'h', MIN_HEIGHT),
  )

  return problems
}

function checkTest(where, example, params, tests) {
  const id = params.get('test')
  const frame = params.get('frame')

  if (id === null) {
    return frame === null ? [] : [`${where}: frame needs a test`]
  }

  const test = tests.find((candidate) => candidate.id === id)

  if (!test) {
    return [
      `${where}: examples/${example} has no test with the id ${id} that the viewer shows. pnpm docs:link ${example} "<full test name>" prints a link`,
    ]
  }

  if (frame === null) {
    return []
  }

  const index = /^\d+$/.test(frame) ? Number(frame) : -1

  if (index < 0 || index >= test.frames.length) {
    return [
      `${where}: frame must be a whole number from 0 to ${test.frames.length - 1}, "${test.fullName}" has ${test.frames.length} frames`,
    ]
  }

  return []
}

function checkSuite(where, example, params, tests) {
  const key = params.get('suite')

  if (key === null) {
    return []
  }

  const cut = key.indexOf('::')
  const moduleId = cut < 0 ? key : key.slice(0, cut)
  const tail = cut < 0 ? '' : key.slice(cut + 2)
  const inModule = tests.filter((test) => test.moduleId === moduleId)

  if (inModule.length === 0) {
    return [`${where}: examples/${example} has no module ${moduleId} with tests the viewer shows`]
  }

  const path = tail ? tail.split(' > ') : []
  const found = inModule.some((test) => path.every((name, index) => test.path[index] === name))

  if (!found) {
    return [`${where}: ${moduleId} has no suite "${tail}"`]
  }

  return []
}

function checkSize(where, params, key, minimum) {
  const text = params.get(key)

  if (text === null) {
    return []
  }

  const size = /^\d+$/.test(text) ? Number(text) : -1

  if (size < minimum || size > MAX_SIZE) {
    return [`${where}: ${key} must be a whole number from ${minimum} to ${MAX_SIZE}`]
  }

  return []
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
