import type { ManifestGenerator } from '@describe-me/core/types'
import type { ChangesReport } from './changes-report.js'
import type { TextFormat } from './text-format.js'

const BEFORE_GENERATOR = 'a version before 0.5.1'

function generatorText(
  generator: ManifestGenerator | undefined,
  format: TextFormat,
  sameName: boolean,
): string {
  if (generator === undefined) {
    return BEFORE_GENERATOR
  }

  const version = format.word(generator.version)

  return sameName ? version : `${format.code(generator.name)} ${version}`
}

/**
 * The sentence that says the runs were recorded with different versions, so
 * some changes may come from the update. `undefined` when they were not.
 */
export function versionNote(report: ChangesReport, format: TextFormat): string | undefined {
  if (!report.versionsDiffer) {
    return undefined
  }

  const base = report.base.generator
  const head = report.head.generator
  const sameName = base !== undefined && base.name === head?.name

  return (
    `The base was recorded with ${generatorText(base, format, false)} and this run with ` +
    `${generatorText(head, format, sameName)}. Some changes may come from the update.`
  )
}
