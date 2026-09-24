import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import type { ViteUserConfig } from 'vitest/config'

interface PackageJson {
  version?: string
  module?: string
  browser?: string | Record<string, string | false>
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
 */
export function styledComponentsBrowserBuild(root: string): ViteUserConfig | undefined {
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

  return {
    resolve: { alias: [{ find: /^styled-components$/, replacement }] },
    test: { deps: { optimizer: { client: { enabled: true, include } } } },
  }
}
