import type { ChangesReport } from './changes-report.js'
import type { ChangesSection } from './changes-sections.js'
import { changesSections } from './changes-sections.js'
import { changesSentence } from './changes-sentence.js'
import { countText } from './count-text.js'
import { markdownFormat } from './markdown-format.js'
import { versionNote } from './version-note.js'

/** The first line, by which a workflow finds its earlier comment. */
const MARKER = '<!-- describe-me:changes -->'

/** The longest name, path, type or value an item shows, so one name cannot fill the comment. */
const MAX_NAME = 300

function listLines(section: ChangesSection, cap: number): string[] {
  const lines: string[] = []
  let module: string | undefined

  for (const item of section.items.slice(0, cap)) {
    if (item.module !== undefined && item.module !== module) {
      lines.push('', item.module, '')
      module = item.module
    }

    lines.push(`- ${item.text}`)
  }

  if (section.items.length > cap) {
    lines.push(`- and ${section.items.length - cap} more`)
  }

  // A module line opens with a blank line, which the heading already gives.
  return lines[0] === '' ? lines.slice(1) : lines
}

function sectionText(section: ChangesSection, cap: number): string {
  const list = listLines(section, cap).join('\n')

  if (section.id !== 'css') {
    return `### ${section.title}\n\n${list}`
  }

  const summary = `${countText(section.items.length, 'test')} changed only in CSS`

  return `<details><summary>${summary}</summary>\n\n${list}\n\n</details>`
}

function joined(blocks: string[]): string {
  return `${blocks.join('\n\n')}\n`
}

/** The largest number of items per list that keeps `render` within `limit`, or `undefined`. */
function fittingCap(
  render: (cap: number) => string,
  longest: number,
  limit: number,
): number | undefined {
  if (render(0).length > limit) {
    return undefined
  }

  let low = 0
  let high = longest

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)

    if (render(middle).length <= limit) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  // Dropping the `- and N more` line can make a longer cap a few characters longer than a shorter one.
  while (low > 0 && render(low).length > limit) {
    low--
  }

  return low
}

/**
 * The body of a pull request comment for a report, at most `limit`
 * characters, GitHub's comment limit by default. It starts with a marker
 * line and the summary sentence, which always stay. When the lists do not
 * fit, each is cut to fewer items and ends with `- and N more`.
 */
export function changesMarkdown(report: ChangesReport, limit = 65_536): string {
  const format = markdownFormat(MAX_NAME)
  const note = versionNote(report, format)
  const head = [MARKER, changesSentence(report), ...(note === undefined ? [] : [`> ${note}`])]
  const sections = changesSections(report, format)
  const render = (cap: number): string =>
    joined([...head, ...sections.map((section) => sectionText(section, cap))])

  const longest = Math.max(0, ...sections.map((section) => section.items.length))
  const cap = fittingCap(render, longest, limit)

  return cap === undefined ? joined(head.slice(0, 2)) : render(cap)
}
