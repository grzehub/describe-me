import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { firstLineOf } from './first-line-of.js'

/** One entry of Tailwind's theme: the key, such as `--color-red-500`, and its value and flags. */
export type TailwindThemeEntry = [string, { value: string; options: number }]

/** The theme entries, or the one sentence that says why they could not be read. */
export type TailwindThemeResult = { entries: TailwindThemeEntry[] } | { error: string }

/** The part of `@tailwindcss/node` the theme needs. */
interface TailwindNode {
  __unstable__loadDesignSystem?: unknown
}

/** The plugins that bring `@tailwindcss/node`, tried before the module itself. */
const TAILWIND_PLUGINS = ['@tailwindcss/vite', '@tailwindcss/postcss']

const TAILWIND_NODE = '@tailwindcss/node'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * pnpm installs `@tailwindcss/node` as a dependency of the plugin, not of the
 * project, so it resolves from the plugin's entry. A project that installs it
 * directly still works.
 */
function resolveTailwindNode(root: string): string | undefined {
  const fromRoot = createRequire(join(root, 'package.json'))

  for (const plugin of TAILWIND_PLUGINS) {
    try {
      return createRequire(fromRoot.resolve(plugin)).resolve(TAILWIND_NODE)
    } catch {
      // Not installed, or installed without @tailwindcss/node next to it.
    }
  }

  try {
    return fromRoot.resolve(TAILWIND_NODE)
  } catch {
    return undefined
  }
}

function themeEntries(designSystem: unknown): TailwindThemeEntry[] | undefined {
  const theme = isObject(designSystem) ? designSystem.theme : undefined

  if (!isObject(theme) || typeof theme.entries !== 'function') {
    return undefined
  }

  const entries: TailwindThemeEntry[] = []

  for (const entry of theme.entries() as Iterable<unknown>) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !isObject(entry[1])) {
      continue
    }

    const { value, options } = entry[1]

    if (typeof value === 'string') {
      entries.push([entry[0], { value, options: typeof options === 'number' ? options : 0 }])
    }
  }

  return entries
}

/**
 * Loads the Tailwind 4 theme of an entry file with the project's own
 * `@tailwindcss/node`. The imported module is kept in `modules`, so watch
 * mode imports it once.
 */
export async function loadTailwindTheme(
  root: string,
  entry: string,
  modules: Map<string, Promise<unknown>>,
): Promise<TailwindThemeResult> {
  const resolved = resolveTailwindNode(root)

  if (resolved === undefined) {
    return {
      error:
        'foundations: Tailwind 4 is installed, but @tailwindcss/node does not resolve from the root, so only the recorded CSS variables are read',
    }
  }

  const failed = (reason: string) => ({
    error: `foundations: the Tailwind theme of ${entry} did not load: ${reason}`,
  })

  try {
    let loading = modules.get(resolved)

    if (loading === undefined) {
      loading = import(pathToFileURL(resolved).href)
      modules.set(resolved, loading)
    }

    const tailwindNode = (await loading) as TailwindNode
    const loadDesignSystem = tailwindNode.__unstable__loadDesignSystem

    if (typeof loadDesignSystem !== 'function') {
      return failed('@tailwindcss/node has no __unstable__loadDesignSystem')
    }

    const entryFile = resolve(root, entry)
    const designSystem: unknown = await loadDesignSystem(readFileSync(entryFile, 'utf8'), {
      base: dirname(entryFile),
    })

    const entries = themeEntries(designSystem)

    return entries === undefined ? failed('its design system has no theme entries') : { entries }
  } catch (error) {
    modules.delete(resolved)

    return failed(firstLineOf(error))
  }
}
