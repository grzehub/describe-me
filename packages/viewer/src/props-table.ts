import { collapseProps } from './collapse-props.js'
import type { CoverageEntry, PropCoverage } from './coverage.js'
import { el } from './el.js'

function chip(entry: CoverageEntry): HTMLElement {
  const mark = entry.covered ? '✓' : '✗'
  const tone = entry.covered ? 'covered' : 'missing'
  const node = el('span', { class: `chip ${tone}` }, `${entry.label} ${mark}`)
  if (entry.isDefault) {
    node.append(el('span', { class: 'chip-default' }, ' (default)'))
  }

  return node
}

function nameCell(coverage: PropCoverage): HTMLElement {
  return el(
    'td',
    { class: 'prop-name', title: coverage.prop.description ?? false },
    coverage.prop.name,
    coverage.prop.required ? el('span', { class: 'req' }, '*') : null,
  )
}

function coveredCell(coverage: PropCoverage): HTMLElement {
  const cell = el('td', { class: 'prop-covered' })
  if (coverage.entries.length) {
    for (const entry of coverage.entries) {
      cell.append(chip(entry))
    }

    return cell
  }

  if (coverage.passedIn > 0) {
    const text = `passed in ${coverage.passedIn} of ${coverage.testsTotal} tests`
    cell.append(el('span', { class: 'hint' }, text))

    return cell
  }

  cell.append(
    el('span', { class: coverage.prop.required ? 'chip missing' : 'hint' }, 'never passed'),
  )

  return cell
}

/**
 * The props of one component as a table: name, type, and which values the tests
 * covered. A long table folds, and `key` keeps it unfolded across repaints.
 */
export function renderPropsTable(coverage: PropCoverage[], key: string): HTMLElement[] {
  const table = el('table', { class: 'kv props' })
  table.append(el('tr', {}, el('th', {}, 'prop'), el('th', {}, 'type'), el('th', {}, 'covered')))

  if (!coverage.length) {
    table.append(
      el('tr', {}, el('td', { colspan: '3' }, el('span', { class: 'hint' }, 'no props'))),
    )

    return [table]
  }

  const rows = coverage.map((item) =>
    el(
      'tr',
      {},
      nameCell(item),
      el('td', { class: 'prop-type' }, item.prop.type),
      coveredCell(item),
    ),
  )

  return collapseProps(table, rows, key)
}
