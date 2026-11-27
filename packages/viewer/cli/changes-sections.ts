import type { ChangesReport, TestChange } from './changes-report.js'
import { isCssOnly } from './is-css-only.js'
import { propChangeLines } from './prop-change-lines.js'
import { testChangeText } from './test-change-text.js'
import type { TextFormat } from './text-format.js'

/** One item of a section. Items of tests carry their module, already formatted. */
export interface SectionItem {
  module?: string
  text: string
}

/** A list of a report, such as the added tests. */
export interface ChangesSection {
  id: 'changed' | 'props' | 'added' | 'removed' | 'moved' | 'css'
  title: string
  items: SectionItem[]
}

function testItems(tests: TestChange[], format: TextFormat): SectionItem[] {
  return tests.map((test) => ({
    module: format.code(test.module),
    text: testChangeText(test, format),
  }))
}

/**
 * The lists of a report in the order they are shown, empty ones left out:
 * tests whose DOM or state changed, props, added, removed and moved tests,
 * and last the tests that changed only in CSS.
 */
export function changesSections(report: ChangesReport, format: TextFormat): ChangesSection[] {
  const changed = report.tests.filter((test) => test.change === 'changed' && !isCssOnly(test))
  const byChange = (change: TestChange['change']): TestChange[] =>
    report.tests.filter((test) => test.change === change)

  const sections: ChangesSection[] = [
    { id: 'changed', title: 'Changed', items: testItems(changed, format) },
    {
      id: 'props',
      title: 'Props',
      items: report.components.flatMap((component) =>
        propChangeLines(component, format).map((text) => ({ text })),
      ),
    },
    { id: 'added', title: 'Added', items: testItems(byChange('added'), format) },
    { id: 'removed', title: 'Removed', items: testItems(byChange('removed'), format) },
    { id: 'moved', title: 'Moved', items: testItems(byChange('moved'), format) },
    {
      id: 'css',
      title: 'Changed only in CSS',
      items: testItems(report.tests.filter(isCssOnly), format),
    },
  ]

  return sections.filter((section) => section.items.length > 0)
}
