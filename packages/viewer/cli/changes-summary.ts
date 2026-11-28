import type { ChangesReport } from './changes-report.js'
import type { ChangesSection } from './changes-sections.js'
import { changesSections } from './changes-sections.js'
import { changesSentence } from './changes-sentence.js'
import { countText } from './count-text.js'
import type { TextFormat } from './text-format.js'
import { versionNote } from './version-note.js'

function oneLine(text: string): string {
  return text.replace(/\s*[\r\n]+\s*/g, ' ')
}

const PLAIN: TextFormat = { code: oneLine, word: oneLine }

function sectionLines(section: ChangesSection): string[] {
  const lines = ['', section.title]
  let module: string | undefined

  for (const item of section.items) {
    if (item.module !== undefined && item.module !== module) {
      lines.push(`  ${item.module}`)
      module = item.module
    }

    lines.push(item.module === undefined ? `  ${item.text}` : `    ${item.text}`)
  }

  return lines
}

/**
 * A report as plain text for the terminal: the summary sentence, the version
 * note, the tests whose DOM or state changed by file, the prop changes, the
 * added, removed and moved tests, and how many tests changed only in CSS.
 */
export function changesSummary(report: ChangesReport): string {
  const lines = [changesSentence(report)]
  const note = versionNote(report, PLAIN)

  if (note !== undefined) {
    lines.push(note)
  }

  for (const section of changesSections(report, PLAIN)) {
    if (section.id === 'css') {
      lines.push('', `${countText(section.items.length, 'test')} changed only in CSS.`)
    } else {
      lines.push(...sectionLines(section))
    }
  }

  return `${lines.join('\n')}\n`
}
