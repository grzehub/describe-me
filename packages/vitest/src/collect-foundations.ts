import type {
  Foundations,
  FoundationsSystem,
  FoundationToken,
  ManifestFoundations,
} from '@describe-me/core/types'
import { detectDesignSystems } from './detect-design-systems.js'
import { findTailwindEntry } from './find-tailwind-entry.js'
import { firstLineOf } from './first-line-of.js'
import { importTheme, type ImportModule } from './import-theme.js'
import { loadTailwindTheme } from './load-tailwind-theme.js'
import type { ProjectPaths } from './project-paths.js'
import type { RecordedSheets } from './recorded-sheets.js'
import { tailwindTokens } from './tailwind-tokens.js'
import type { FoundationsOption } from './validate-foundations.js'

/** What the reporter hands the collector at the end of a run. */
export interface CollectFoundationsInput {
  root: string
  /** The kept snapshots, relative to the output directory, once each, in manifest order. */
  snapshotFiles: string[]
  option: FoundationsOption
  importModule: ImportModule | undefined
  paths: ProjectPaths
  /** Kept on the reporter, so watch mode reads each snapshot once. */
  sheets: RecordedSheets
  /** Kept on the reporter, so watch mode imports `@tailwindcss/node` once. */
  tailwindModules: Map<string, Promise<unknown>>
}

/** What `collectFoundations()` gives: the file's contents and what the manifest says about them. */
export interface CollectedFoundations {
  foundations: Foundations
  summary: ManifestFoundations
}

/** The Tailwind entry and its tokens. */
interface TailwindPart {
  tailwind?: Foundations['tailwind']
  tokens: FoundationToken[]
  errors: string[]
}

function unexpected(error: unknown): string {
  return `foundations: collecting failed: ${firstLineOf(error)}`
}

function majorVersion(system: FoundationsSystem | undefined): number {
  return Number.parseInt(system?.version?.split('.')[0] ?? '', 10)
}

/** What the Tailwind part needs from the parts read before it. */
interface TailwindInput {
  systems: FoundationsSystem[]
  cssSources: string[]
  shadcnCss: string | undefined
}

async function readTailwind(
  input: CollectFoundationsInput,
  { systems, cssSources, shadcnCss }: TailwindInput,
): Promise<TailwindPart> {
  const entry = findTailwindEntry(input.root, cssSources, shadcnCss)

  if (entry === undefined) {
    return { tokens: [], errors: [] }
  }

  const tailwind = systems.find((system) => system.id === 'tailwind')

  // Tailwind 3 keeps its theme in tailwind.config.js, which is out of scope.
  if (!(majorVersion(tailwind) >= 4)) {
    return { tailwind: { entry }, tokens: [], errors: [] }
  }

  const result = await loadTailwindTheme(input.root, entry, input.tailwindModules)

  if ('error' in result) {
    return { tailwind: { entry }, tokens: [], errors: [result.error] }
  }

  return { tailwind: { entry }, tokens: tailwindTokens(result.entries), errors: [] }
}

/** Runs one source, so a failing one costs only its own part. */
async function attempt<T>(errors: string[], read: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch (error) {
    errors.push(unexpected(error))

    return undefined
  }
}

/**
 * Collect the design-system foundations of a run for `foundations.json`: the
 * design systems, the recorded token and font sheets, the Tailwind 4 theme
 * and the tokens of the theme module. Never throws and never prints. Every
 * problem is one sentence in `errors`.
 */
export async function collectFoundations(
  input: CollectFoundationsInput,
): Promise<CollectedFoundations> {
  const started = performance.now()
  const errors: string[] = []
  const detected = await attempt(errors, () => detectDesignSystems(input.root))
  const sheets = await attempt(errors, () => input.sheets.read(input.snapshotFiles))
  const systems = detected?.systems ?? []
  const cssSources = sheets?.cssSources ?? []
  const shadcn = detected?.shadcn

  const tailwind = await attempt(errors, () =>
    readTailwind(input, { systems, cssSources, shadcnCss: shadcn?.css }),
  )

  errors.push(...(tailwind?.errors ?? []))

  const themeOption = input.option.theme
  const imported =
    themeOption === undefined
      ? undefined
      : await attempt(errors, () =>
          importTheme(themeOption, input.root, input.importModule, input.paths),
        )

  errors.push(...(imported?.errors ?? []))

  const foundations: Foundations = {
    version: 1,
    systems,
    shadcn,
    tokenSheets: sheets?.tokenSheets ?? [],
    fontSheets: sheets?.fontSheets ?? [],
    cssSources,
    tailwind: tailwind?.tailwind,
    theme: imported?.theme,
    tokens: [...(tailwind?.tokens ?? []), ...(imported?.tokens ?? [])],
    errors: errors.map((error) => input.paths.inText(error)),
    duration: Math.round(performance.now() - started),
  }

  const names = new Set([
    ...(sheets?.rootNames ?? []),
    ...foundations.tokens.map((token) => token.name),
  ])

  const summary: ManifestFoundations = {
    systems: systems.map((system) => system.id),
    tokens: names.size,
  }

  if (foundations.errors.length > 0) {
    summary.errors = foundations.errors
  }

  return { foundations, summary }
}
