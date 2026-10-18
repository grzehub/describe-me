import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { DesignSystemId, Foundations, FoundationsSystem } from '@describe-me/core/types'

/** The package each design system is found by, in the order of `DesignSystemId`. shadcn comes from `components.json`. */
const SYSTEM_PACKAGES: [DesignSystemId, string][] = [
  ['tailwind', 'tailwindcss'],
  ['mui', '@mui/material'],
  ['chakra', '@chakra-ui/react'],
  ['mantine', '@mantine/core'],
  ['radix-themes', '@radix-ui/themes'],
  ['styled-components', 'styled-components'],
  ['emotion', '@emotion/react'],
  ['antd', 'antd'],
]

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** The nearest `package.json` at or above the root. */
function nearestPackageJson(root: string): string | undefined {
  for (let directory = root; ; directory = dirname(directory)) {
    const file = join(directory, 'package.json')

    if (existsSync(file)) {
      return file
    }

    if (directory === dirname(directory)) {
      return undefined
    }
  }
}

function dependencyNames(manifest: unknown): Set<string> {
  const names = new Set<string>()

  if (!isObject(manifest)) {
    return names
  }

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field]

    for (const name of isObject(dependencies) ? Object.keys(dependencies) : []) {
      names.add(name)
    }
  }

  return names
}

function versionIn(file: string, packageName: string): string | undefined {
  const manifest = readJson(file)

  if (
    !isObject(manifest) ||
    manifest.name !== packageName ||
    typeof manifest.version !== 'string'
  ) {
    return undefined
  }

  return manifest.version
}

/** The installed version, from `<package>/package.json`, else from the entry and up. */
function installedVersion(root: string, packageName: string): string | undefined {
  const fromRoot = createRequire(join(root, 'package.json'))

  try {
    return versionIn(fromRoot.resolve(`${packageName}/package.json`), packageName)
  } catch {
    // The package does not export `./package.json`.
  }

  let directory: string

  try {
    directory = dirname(fromRoot.resolve(packageName))
  } catch {
    return undefined
  }

  while (directory !== dirname(directory)) {
    const version = versionIn(join(directory, 'package.json'), packageName)

    if (version !== undefined) {
      return version
    }

    directory = dirname(directory)
  }

  return undefined
}

function systemOf(root: string, id: DesignSystemId, packageName: string): FoundationsSystem {
  const version = installedVersion(root, packageName)

  return version === undefined
    ? { id, package: packageName }
    : { id, package: packageName, version }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** The shadcn/ui settings of a readable `components.json`. */
function readComponentsJson(file: string): Foundations['shadcn'] {
  const config = readJson(file)

  if (!isObject(config)) {
    return undefined
  }

  const tailwind = isObject(config.tailwind) ? config.tailwind : {}
  const shadcn: NonNullable<Foundations['shadcn']> = {}
  const style = stringOrUndefined(config.style)
  const baseColor = stringOrUndefined(tailwind.baseColor)
  const css = stringOrUndefined(tailwind.css)

  if (style !== undefined) {
    shadcn.style = style
  }

  if (baseColor !== undefined) {
    shadcn.baseColor = baseColor
  }

  if (css !== undefined) {
    shadcn.css = css
  }

  return shadcn
}

/**
 * The design systems a project uses, by the packages its nearest
 * `package.json` names, and shadcn/ui by a `components.json` next to it.
 */
export function detectDesignSystems(root: string): {
  systems: FoundationsSystem[]
  shadcn?: Foundations['shadcn']
} {
  const packageJson = nearestPackageJson(root)

  if (packageJson === undefined) {
    return { systems: [] }
  }

  // Not by resolving: pnpm's bin shims put the workspace's hoisted packages on
  // NODE_PATH, so every project would resolve what any of them installs.
  const named = dependencyNames(readJson(packageJson))
  const shadcn = readComponentsJson(join(dirname(packageJson), 'components.json'))
  const systems: FoundationsSystem[] = []

  for (const [id, packageName] of SYSTEM_PACKAGES) {
    if (named.has(packageName)) {
      systems.push(systemOf(root, id, packageName))
    }

    if (id === 'tailwind' && shadcn !== undefined) {
      systems.push({ id: 'shadcn' })
    }
  }

  return shadcn === undefined ? { systems } : { systems, shadcn }
}
