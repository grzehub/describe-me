import type { ChangesReport, ShotsSummary, TestChange } from './changes-report.js'
import { countText } from './count-text.js'
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
  id: 'different' | 'changed' | 'props' | 'added' | 'removed' | 'moved' | 'css'
  title: string
  items: SectionItem[]
  /** A line after the list, which stays when the list is cut. */
  note?: string
}

function testItems(tests: TestChange[], format: TextFormat, looks = false): SectionItem[] {
  return tests.map((test) => ({
    module: format.code(test.module),
    text: testChangeText(test, format, looks),
  }))
}

/**
 * The image follows inside the item, so it is cut with it. Its alt text
 * holds no text from the manifest, so a `]` in a name cannot break it.
 */
function imageItems(tests: TestChange[], format: TextFormat, looks: boolean): SectionItem[] {
  return testItems(tests, format, looks).map((item, i) => {
    const shot = tests[i].shot

    if (shot === undefined) {
      return item
    }

    const alt = looks
      ? `frame ${shot.frame + 1}: before, after and the changed pixels`
      : `frame ${shot.frame + 1}, as it renders`

    return { ...item, text: `${item.text}\n\n  ![${alt}](./${shot.file})` }
  })
}

/** The line that says how many tests have no image because of `--max-shots`, if any. */
function budgetNote(withoutImage: number, shots: ShotsSummary): string | undefined {
  if (withoutImage <= 0) {
    return undefined
  }

  const verb = withoutImage === 1 ? 'has' : 'have'

  return `${countText(withoutImage, 'test')} ${verb} no image, because \`--max-shots\` is ${shots.maxShots}.`
}

/**
 * With `--shots`: the tests that look different first, with their images,
 * then the other changed tests, props, added tests with images, removed and
 * moved tests, and last the tests that changed only in CSS and look the same.
 */
function shotSections(
  report: ChangesReport,
  shots: ShotsSummary,
  format: TextFormat,
): ChangesSection[] {
  const changed = report.tests.filter((test) => test.change === 'changed')
  const different = changed.filter((test) => test.look === 'different')
  const folded = changed.filter((test) => isCssOnly(test) && test.look === 'same')
  const rest = changed.filter((test) => !different.includes(test) && !folded.includes(test))
  const added = report.tests.filter((test) => test.change === 'added')
  const addedWithFrames = added.filter((test) => test.frames.length > 0).length
  const addedBudget = Math.max(0, shots.maxShots - different.length)
  const byChange = (change: TestChange['change']): TestChange[] =>
    report.tests.filter((test) => test.change === change)

  const sections: ChangesSection[] = [
    {
      id: 'different',
      title: 'Looks different',
      items: imageItems(different, format, true),
      note: budgetNote(different.length - shots.maxShots, shots),
    },
    { id: 'changed', title: 'Changed', items: testItems(rest, format, true) },
    propsSection(report, format),
    {
      id: 'added',
      title: 'Added',
      items: imageItems(added, format, false),
      note: budgetNote(addedWithFrames - addedBudget, shots),
    },
    { id: 'removed', title: 'Removed', items: testItems(byChange('removed'), format) },
    { id: 'moved', title: 'Moved', items: testItems(byChange('moved'), format) },
    { id: 'css', title: 'Changed only in CSS', items: testItems(folded, format) },
  ]

  return sections.filter((section) => section.items.length > 0)
}

function propsSection(report: ChangesReport, format: TextFormat): ChangesSection {
  return {
    id: 'props',
    title: 'Props',
    items: report.components.flatMap((component) =>
      propChangeLines(component, format).map((text) => ({ text })),
    ),
  }
}

/**
 * The lists of a report in the order they are shown, empty ones left out:
 * tests whose DOM or state changed, props, added, removed and moved tests,
 * and last the tests that changed only in CSS. A report with `shots` starts
 * with the tests that look different, and folds only the CSS-only tests that
 * look the same.
 */
export function changesSections(report: ChangesReport, format: TextFormat): ChangesSection[] {
  if (report.shots !== undefined) {
    return shotSections(report, report.shots, format)
  }

  const changed = report.tests.filter((test) => test.change === 'changed' && !isCssOnly(test))
  const byChange = (change: TestChange['change']): TestChange[] =>
    report.tests.filter((test) => test.change === change)

  const sections: ChangesSection[] = [
    { id: 'changed', title: 'Changed', items: testItems(changed, format) },
    propsSection(report, format),
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
