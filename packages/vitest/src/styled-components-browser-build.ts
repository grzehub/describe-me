import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import type { ViteUserConfig } from 'vitest/config'
import { styledComponentsTslib } from './styled-components-tslib.js'

interface PackageJson {
  version?: string
  module?: string
  browser?: string | Record<string, string | false>
}

interface Alias {
  find: RegExp
  replacement: string
}

type ResolveFromRoot = (id: string) => string | undefined

function resolverFor(root: string): ResolveFromRoot {
  // createRequire wants an absolute file inside the directory; it does not have to exist.
  const requireFromRoot = createRequire(join(resolve(root), 'package.json'))

  return (id) => {
    try {
      return requireFromRoot.resolve(id)
    } catch {
      return undefined
    }
  }
}

function withoutDotSlash(path: string): string {
  return path.replace(/^\.\//, '')
}

/** The file the package's `browser` map swaps its `module` entry for, relative to the package. */
function browserModule(pkg: PackageJson): string | undefined {
  if (!pkg.module || !pkg.browser || typeof pkg.browser === 'string') {
    return undefined
  }

  const moduleEntry = withoutDotSlash(pkg.module)

  for (const [from, to] of Object.entries(pkg.browser)) {
    if (withoutDotSlash(from) === moduleEntry && typeof to === 'string') {
      return to
    }
  }

  return undefined
}

/** The config that loads the browser build, and a setup problem found on the way. */
export interface StyledComponentsBrowserBuild {
  config: ViteUserConfig
  /** Set when the build's tslib cannot be aliased, so it may fail to load. */
  warning?: string
}

/**
 * The Vite and Vitest config that makes a DOM environment load the browser
 * build of styled-components, or undefined when the project does not use
 * styled-components 5 or later.
 *
 * Vitest resolves the Node build, whose `createGlobalStyle` never inserts its
 * CSS on the client, so global resets and fonts would be missing from every
 * snapshot. The alias points `styled-components` at the browser ESM file. The
 * optimizer is needed as well: jest-styled-components `require`s
 * styled-components through Node, which ignores the alias, and would get a
 * second instance whose styles its serializer cannot see. Bundling both
 * together gives them one.
 *
 * The optimizer bundles tslib's UMD file without its default export, which the
 * browser build of 6.0 to 6.3 destructures. An alias is the only resolution the
 * optimizer applies, so `tslib` is aliased to its ES module for the whole config.
 */
export function styledComponentsBrowserBuild(
  root: string,
): StyledComponentsBrowserBuild | undefined {
  const resolveFromRoot = resolverFor(root)
  const manifest = resolveFromRoot('styled-components/package.json')

  if (!manifest) {
    return undefined
  }

  const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as PackageJson
  const major = Number.parseInt(pkg.version ?? '', 10)
  const browserFile = browserModule(pkg)

  if (Number.isNaN(major) || major < 5 || !browserFile) {
    return undefined
  }

  const replacement = join(dirname(manifest), browserFile)
  if (!existsSync(replacement)) {
    return undefined
  }

  const include = ['styled-components']
  if (resolveFromRoot('jest-styled-components')) {
    include.push('jest-styled-components')
  }

  const alias: Alias[] = [{ find: /^styled-components$/, replacement }]
  const tslib = styledComponentsTslib(manifest)

  if (tslib.kind === 'alias') {
    alias.push({ find: /^tslib$/, replacement: tslib.replacement })
  }

  const config: ViteUserConfig = {
    resolve: { alias },
    test: { deps: { optimizer: { client: { enabled: true, include } } } },
  }

  if (tslib.kind === 'warning') {
    return { config, warning: tslib.warning }
  }

  return { config }
}
