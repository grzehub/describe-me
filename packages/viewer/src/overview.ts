import type { ComponentDoc, ManifestTest } from '@describe-me/core/types'
import { computeCoverage } from './coverage.js'
import { el } from './el.js'
import { renderPropsTable } from './props-table.js'
import { componentNamesInScope } from './scope-components.js'
import { renderStatesGallery } from './states-gallery.js'
import { testsInScope } from './scope.js'
import { state } from './state.js'
import { parseSuiteKey } from './suite-key.js'

function titleOf(key: string): string {
  const { moduleId, path } = parseSuiteKey(key)

  return path[path.length - 1] ?? moduleId
}

function renderHead(key: string, tests: ManifestTest[], docs: Record<string, ComponentDoc>) {
  const files = componentNamesInScope(tests)
    .map((name) => docs[name]?.file)
    .filter((file): file is string => Boolean(file))

  const frames = tests.reduce((sum, test) => sum + test.frames.length, 0)
  const parts = [...new Set(files), `${tests.length} tests`, `${frames} frames`]

  return el(
    'div',
    { class: 'overview-head' },
    el('h1', {}, titleOf(key)),
    el('div', { class: 'overview-meta' }, parts.join(' · ')),
  )
}

function renderComponent(
  name: string,
  doc: ComponentDoc | undefined,
  tests: ManifestTest[],
  showName: boolean,
): HTMLElement {
  const section = el('section', { class: 'overview-section' })
  if (showName) {
    section.append(el('h2', {}, name))
  }

  section.append(el('h3', {}, 'props'))
  if (doc) {
    section.append(renderPropsTable(computeCoverage(doc, tests)))
  } else {
    const hint = 'no type information (rerun tests with the latest reporter)'
    section.append(renderPropsTable([]), el('div', { class: 'hint' }, hint))
  }

  section.append(
    el(
      'h3',
      {},
      'states',
      el('span', { class: 'head-hint' }, '(last frame of every test in scope)'),
    ),
    renderStatesGallery(tests),
  )

  return section
}

/** The main column while a suite or module is selected: what its tests document. */
export function renderOverview(): HTMLElement {
  const main = el('main', { class: 'overview' })
  const key = state.suiteKey
  if (!key) {
    return main
  }

  const tests = testsInScope(key)
  const docs = state.manifest?.components ?? {}
  main.append(renderHead(key, tests, docs))

  // A single component named like the suite would only repeat the page title.
  const names = componentNamesInScope(tests)
  const title = titleOf(key)

  for (const name of names) {
    const own = tests.filter((test) => test.component?.name === name)
    const showName = names.length > 1 || name !== title
    main.append(renderComponent(name, docs[name], own, showName))
  }

  if (!tests.length) {
    main.append(el('div', { class: 'empty' }, 'no tests here'))
  }

  return main
}
