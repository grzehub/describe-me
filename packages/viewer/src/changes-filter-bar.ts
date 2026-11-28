import { changeMarks } from './change-marks.js'
import { el } from './el.js'
import { allTests, filterByChanges, state } from './state.js'

/**
 * The Changed toggle above the tree, with the number of tests the sidebar
 * holds that changed or were added against the base. Nothing without a
 * report or without such a test.
 */
export function changesFilterBar(): HTMLElement[] {
  const marks = changeMarks(state.changes)
  const count = state.manifest
    ? allTests(state.manifest).filter((test) => marks.has(test.id)).length
    : 0

  if (count === 0) {
    return []
  }

  return [
    el(
      'button',
      {
        class: 'changes-toggle',
        'aria-pressed': String(state.changed),
        title: state.changed
          ? 'show every test'
          : 'show only the tests changed or added against the base',
        click: () => filterByChanges(!state.changed),
      },
      el('span', { class: 'changes-toggle-mark', 'aria-hidden': 'true' }),
      'Changed',
      el('span', { class: 'n' }, String(count)),
    ),
  ]
}
