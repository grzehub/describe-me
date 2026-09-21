import type { ManifestTest } from '@describe-me/core/types'
import { computeCoverage } from './coverage.js'
import { el } from './el.js'
import { componentNamesInScope } from './scope-components.js'
import { testsInScope } from './scope.js'
import { state } from './state.js'

interface CoverageTally {
  total: number
  covered: number
  missing: string[]
}

function tally(tests: ManifestTest[]): CoverageTally {
  const docs = state.manifest?.components ?? {}
  const result: CoverageTally = { total: 0, covered: 0, missing: [] }

  for (const name of componentNamesInScope(tests)) {
    const doc = docs[name]
    if (!doc) {
      continue
    }

    const own = tests.filter((test) => test.component?.name === name)
    for (const coverage of computeCoverage(doc, own)) {
      for (const entry of coverage.entries) {
        result.total++
        if (entry.covered) {
          result.covered++
        } else {
          result.missing.push(`${coverage.prop.name}: ${entry.label}`)
        }
      }
    }
  }

  return result
}

function renderCoverage(tests: ManifestTest[]): HTMLElement {
  const section = el('section', {}, el('h3', {}, 'coverage'))
  const counts = tally(tests)
  if (!counts.total) {
    section.append(el('div', { class: 'hint' }, 'no enumerable props here'))

    return section
  }

  section.append(el('div', {}, `${counts.covered} of ${counts.total} values covered`))
  for (const label of counts.missing) {
    section.append(el('div', { class: 'missing-line' }, label))
  }

  return section
}

function renderTests(tests: ManifestTest[]): HTMLElement {
  const failed = tests.filter((test) => test.state === 'failed').length
  const section = el('section', {}, el('h3', {}, 'tests'))
  section.append(el('div', {}, `${tests.length} in scope`))
  section.append(
    el(
      'div',
      { class: failed ? 'missing-line' : 'hint' },
      failed ? `${failed} failed` : 'none failed',
    ),
  )

  return section
}

function renderComponents(tests: ManifestTest[]): HTMLElement {
  const docs = state.manifest?.components ?? {}
  const section = el('section', {}, el('h3', {}, 'components'))
  for (const name of componentNamesInScope(tests)) {
    section.append(
      el(
        'div',
        { class: 'component-line' },
        el('span', {}, name),
        el('span', { class: 'hint' }, docs[name]?.file ?? 'unknown file'),
      ),
    )
  }

  return section
}

/** The right column while a suite or module is selected: what the tests do and do not cover. */
export function renderOverviewInspector(): HTMLElement {
  const aside = el('aside', { class: 'inspector' })
  const key = state.suiteKey
  if (!key) {
    return aside
  }

  const tests = testsInScope(key)
  aside.append(renderCoverage(tests), renderTests(tests), renderComponents(tests))

  return aside
}
