import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** `@import 'tailwindcss'`, `@import "tailwindcss/preflight" layer(base)` or `@import url("tailwindcss")`. */
const TAILWIND_IMPORT = /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[^"']*)?["']/

function importsTailwind(file: string): boolean {
  try {
    return TAILWIND_IMPORT.test(readFileSync(file, 'utf8'))
  } catch {
    return false
  }
}

/**
 * The Tailwind 4 entry file, relative to the root: the first CSS file the
 * frames load that imports `tailwindcss`, else the `tailwind.css` of
 * shadcn/ui's `components.json` when that file exists.
 */
export function findTailwindEntry(
  root: string,
  cssSources: readonly string[],
  shadcnCss: string | undefined,
): string | undefined {
  const entry = cssSources.find((source) => importsTailwind(resolve(root, source)))

  if (entry !== undefined) {
    return entry
  }

  if (shadcnCss !== undefined && existsSync(resolve(root, shadcnCss))) {
    return shadcnCss.replaceAll('\\', '/').replace(/^\.\//, '')
  }

  return undefined
}
