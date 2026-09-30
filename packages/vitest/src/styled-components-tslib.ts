import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** How the browser build of styled-components gets its tslib helpers. */
export type StyledComponentsTslib =
  | { kind: 'untouched' }
  | { kind: 'alias'; replacement: string }
  | { kind: 'warning'; warning: string }

interface PackageJson {
  version?: string
  dependencies?: Record<string, string>
}

function readPackage(manifest: string): PackageJson {
  return JSON.parse(readFileSync(manifest, 'utf8')) as PackageJson
}

function resolveTslib(styledComponentsManifest: string): string | undefined {
  try {
    return createRequire(styledComponentsManifest).resolve('tslib/package.json')
  } catch {
    return undefined
  }
}

/**
 * Where `tslib` should point for the styled-components whose `package.json`
 * is given. Only 6.0 to 6.3 import tslib, and only tslib 2.5.3 and later ship
 * the `tslib.es6.mjs` that keeps its exports intact through the optimizer.
 */
export function styledComponentsTslib(styledComponentsManifest: string): StyledComponentsTslib {
  const styledComponents = readPackage(styledComponentsManifest)

  if (!styledComponents.dependencies?.tslib) {
    return { kind: 'untouched' }
  }

  // Resolved from styled-components itself, so a nested or pnpm-linked tslib
  // wins over whatever the project hoists.
  const tslibManifest = resolveTslib(styledComponentsManifest)

  if (!tslibManifest) {
    return { kind: 'untouched' }
  }

  const replacement = join(dirname(tslibManifest), 'tslib.es6.mjs')

  if (existsSync(replacement)) {
    return { kind: 'alias', replacement }
  }

  const tslib = readPackage(tslibManifest)

  return {
    kind: 'warning',
    warning: `styled-components ${styledComponents.version} resolves tslib ${tslib.version}, which has no tslib.es6.mjs, so its browser build may fail to load ("Cannot destructure property '__extends'"). Upgrade styled-components to 6.1.10 or later, or override tslib to 2.5.3 or later.`,
  }
}
