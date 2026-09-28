import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASSET_URL_PREFIX,
  type FontMissing,
  type Manifest,
  type RemoteStylesheet,
} from '@describe-me/core/types'
import { cssAssetReferences } from './css-asset-references.js'
import { fontFamilyKey } from './font-family-key.js'
import { fontShorthandFamilies } from './font-shorthand-families.js'
import { fontStylesheetFamilies } from './font-stylesheet-families.js'
import { fontUsage, type FontUsage, type FontVarReference } from './font-usage.js'
import { headStylesheets } from './head-stylesheets.js'
import { isSystemFontFamily } from './system-font-family.js'
import { snapshotStyles } from './snapshot-styles.js'

/** What the audit finds in a manifest. */
export interface FontAuditResult {
  fontsMissing: FontMissing[]
  remoteStylesheets: RemoteStylesheet[]
}

/** A stored CSS asset's usage and the `.css` siblings it refers to. */
interface CssAsset {
  usage: FontUsage
  siblings: string[]
}

/** The usage of CSS texts together with the CSS assets they reach. */
interface ReachedCss {
  usages: FontUsage[]
  remoteUrls: string[]
  /** False when a file could not be read, so the result must not be remembered. */
  complete: boolean
}

/** What one snapshot uses and loads, which depends only on content-addressed files. */
interface SnapshotFonts {
  /** Used families, var references resolved, by key with their first spelling. */
  used: Map<string, string>
  /** Keys of the families it loads itself. */
  loaded: Set<string>
  /** Whether it loads a stylesheet whose families are unknown. */
  unknownProvider: boolean
  /** Hosts of its remote stylesheets, loopback left out. */
  hosts: string[]
}

/** What the preview head loads. */
interface HeadFonts {
  loaded: Set<string>
  unknownProvider: boolean
}

/** A reference counts as level 1, so `--a: var(--b)` to `--c: Foo` still resolves. */
const MAX_VAR_LEVELS = 3

/** The test server, whose URLs `assetsMissing` already covers. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

const REMOTE_URL = /^https?:/i

function isRemoteUrl(url: string): boolean {
  return REMOTE_URL.test(url) || url.startsWith('//')
}

/** The stored name behind a `describe-me-asset:` URL, or null for any other URL. */
function assetName(url: string): string | null {
  if (!url.startsWith(ASSET_URL_PREFIX)) {
    return null
  }

  return url.slice(ASSET_URL_PREFIX.length).split(/[?#]/)[0]
}

function hostOf(url: string): string | null {
  const absolute = url.startsWith('//') ? `https:${url}` : url

  return URL.canParse(absolute) ? new URL(absolute).hostname : null
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function mergedVariables(usages: FontUsage[]): Map<string, string[]> {
  const variables = new Map<string, string[]>()

  for (const usage of usages) {
    for (const [name, values] of usage.variables) {
      variables.set(name, [...(variables.get(name) ?? []), ...values])
    }
  }

  return variables
}

/**
 * The first family of a custom property's value, or the `var()` in its place.
 * A value reads as a `font` shorthand when it parses as one, and as a family
 * list otherwise.
 */
function firstFamilyOf(value: string): { family?: string; reference?: FontVarReference } {
  const property = fontShorthandFamilies(value) === null ? 'font-family' : 'font'
  const usage = fontUsage(`${property}: ${value}`)

  return { family: usage.families[0], reference: usage.varRefs[0] }
}

function resolveVar(
  reference: FontVarReference,
  variables: Map<string, string[]>,
  level: number,
): string[] {
  if (level > MAX_VAR_LEVELS) {
    return []
  }

  const definitions = variables.get(reference.name) ?? []
  let values = definitions
  if (definitions.length === 0) {
    values = reference.fallback === undefined ? [] : [reference.fallback]
  }

  return values.flatMap((value) => {
    const first = firstFamilyOf(value)
    if (first.reference) {
      return resolveVar(first.reference, variables, level + 1)
    }

    return first.family === undefined ? [] : [first.family]
  })
}

/** Keys of the families remote stylesheets load, and whether any provider is unknown. */
function remoteFamilies(urls: string[]): { loaded: Set<string>; unknownProvider: boolean } {
  const loaded = new Set<string>()
  let unknownProvider = false

  for (const url of urls) {
    const families = fontStylesheetFamilies(url)
    if (families === null) {
      unknownProvider = true
      continue
    }

    for (const family of families) {
      loaded.add(fontFamilyKey(family))
    }
  }

  return { loaded, unknownProvider }
}

function remoteHosts(urls: string[]): string[] {
  const hosts = new Set<string>()

  for (const url of urls) {
    const host = hostOf(url)
    if (host && !LOOPBACK_HOSTS.has(host)) {
      hosts.add(host)
    }
  }

  return [...hosts]
}

function parsedJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * The families that stylesheets and `style` attributes use, with each `var()`
 * resolved against the stylesheets' custom properties. Keyed, with the first
 * spelling, and without system families.
 */
function usedFamilies(sheets: FontUsage[], attributes: FontUsage[]): Map<string, string> {
  const variables = mergedVariables(sheets)
  const used = new Map<string, string>()

  const add = (family: string) => {
    const key = fontFamilyKey(family)
    if (!used.has(key) && !isSystemFontFamily(family)) {
      used.set(key, family)
    }
  }

  for (const usage of [...sheets, ...attributes]) {
    usage.families.forEach(add)

    for (const reference of usage.varRefs) {
      resolveVar(reference, variables, 1).forEach(add)
    }
  }

  return used
}

function sortedMissing(missing: Map<string, FontMissing>): FontMissing[] {
  return [...missing.values()].sort(
    (left, right) => right.tests - left.tests || left.family.localeCompare(right.family),
  )
}

function sortedHosts(frames: Map<string, number>): RemoteStylesheet[] {
  return Array.from(frames, ([host, count]) => ({ host, frames: count })).sort(
    (left, right) => right.frames - left.frames || left.host.localeCompare(right.host),
  )
}

/**
 * Finds the font families that frames use but nothing loads, and the hosts
 * that frames load stylesheets from. Snapshots, style chunks and assets are
 * content-addressed, so what it read stays valid for the reporter's lifetime.
 */
export class FontAudit {
  private readonly outDir: string
  private readonly chunks = new Map<string, FontUsage>()
  private readonly cssAssets = new Map<string, CssAsset>()
  private readonly snapshots = new Map<string, SnapshotFonts>()

  constructor(outDir: string) {
    this.outDir = outDir
  }

  /** Walk the manifest in order. A file that cannot be read contributes nothing. */
  audit(manifest: Manifest): FontAuditResult {
    const head = this.headFonts(manifest.head)
    const missing = new Map<string, FontMissing>()
    const hostFrames = new Map<string, number>()

    for (const mod of manifest.modules) {
      for (const test of mod.tests) {
        const testMissing = new Map<string, string>()

        for (const frame of test.frames) {
          const fonts = this.snapshotFonts(frame.snapshot)

          for (const host of fonts.hosts) {
            hostFrames.set(host, (hostFrames.get(host) ?? 0) + 1)
          }

          if (!head.unknownProvider) {
            this.addMissing(testMissing, fonts, head)
          }
        }

        for (const [key, family] of testMissing) {
          const entry = missing.get(key)
          if (entry) {
            entry.tests++
          } else {
            missing.set(key, { family, tests: 1, testId: test.id })
          }
        }
      }
    }

    return { fontsMissing: sortedMissing(missing), remoteStylesheets: sortedHosts(hostFrames) }
  }

  private addMissing(
    testMissing: Map<string, string>,
    fonts: SnapshotFonts,
    head: HeadFonts,
  ): void {
    if (fonts.unknownProvider) {
      return
    }

    for (const [key, family] of fonts.used) {
      if (!fonts.loaded.has(key) && !head.loaded.has(key) && !testMissing.has(key)) {
        testMissing.set(key, family)
      }
    }
  }

  /** Only the preview head's `@font-face` rules and font stylesheets count, not its own usage. */
  private headFonts(head: string | undefined): HeadFonts {
    const { styles, links } = headStylesheets(head ?? '')
    const reached = this.reach(
      styles.map((css) => fontUsage(css)),
      links,
    )

    const remote = remoteFamilies(reached.remoteUrls)
    const loaded = new Set(reached.usages.flatMap((usage) => usage.declared).map(fontFamilyKey))

    for (const key of remote.loaded) {
      loaded.add(key)
    }

    return { loaded, unknownProvider: remote.unknownProvider }
  }

  private snapshotFonts(file: string): SnapshotFonts {
    const cached = this.snapshots.get(file)
    if (cached) {
      return cached
    }

    const { fonts, complete } = this.readSnapshotFonts(file)
    if (complete) {
      this.snapshots.set(file, fonts)
    }

    return fonts
  }

  private readSnapshotFonts(file: string): { fonts: SnapshotFonts; complete: boolean } {
    const json = readText(join(this.outDir, file))
    const styles = snapshotStyles(json === null ? null : parsedJson(json))
    const chunks = styles.chunks.map((hash) => this.chunkUsage(hash))
    const sheets = styles.cssTexts.map((css) => fontUsage(css))
    const reached = this.reach(
      [...sheets, ...chunks.filter((usage) => usage !== null)],
      styles.stylesheetLinks,
    )

    const attributes = styles.styleAttributes.map((css) => fontUsage(css))
    const remote = remoteFamilies(reached.remoteUrls)

    for (const family of reached.usages.flatMap((usage) => usage.declared)) {
      remote.loaded.add(fontFamilyKey(family))
    }

    const fonts: SnapshotFonts = {
      used: usedFamilies(reached.usages, attributes),
      loaded: remote.loaded,
      unknownProvider: remote.unknownProvider,
      hosts: remoteHosts(reached.remoteUrls),
    }

    return { fonts, complete: json !== null && reached.complete && !chunks.includes(null) }
  }

  /**
   * Add the CSS assets that stylesheets reach through asset links and
   * `@import`s, transitively, and collect their remote URLs. Any other URL,
   * such as a root-relative one left by a missing file, is ignored.
   */
  private reach(sheets: FontUsage[], links: string[]): ReachedCss {
    const reached: ReachedCss = { usages: [...sheets], remoteUrls: [], complete: true }
    const seen = new Set<string>()
    const pending: string[] = []

    const follow = (url: string) => {
      const name = assetName(url)
      if (isRemoteUrl(url)) {
        reached.remoteUrls.push(url)
      } else if (name !== null) {
        pending.push(name)
      }
    }

    links.forEach(follow)
    sheets.forEach((usage) => usage.imports.forEach(follow))

    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      if (seen.has(name) || !name.endsWith('.css')) {
        continue
      }

      seen.add(name)
      const asset = this.cssAsset(name)
      if (asset === null) {
        reached.complete = false
        continue
      }

      reached.usages.push(asset.usage)
      pending.push(...asset.siblings)
      asset.usage.imports.filter(isRemoteUrl).forEach((url) => reached.remoteUrls.push(url))
    }

    return reached
  }

  private chunkUsage(hash: string): FontUsage | null {
    const cached = this.chunks.get(hash)
    if (cached) {
      return cached
    }

    const css = readText(join(this.outDir, 'styles', `${hash}.css`))
    if (css === null) {
      return null
    }

    const usage = fontUsage(css)
    this.chunks.set(hash, usage)

    return usage
  }

  private cssAsset(name: string): CssAsset | null {
    const cached = this.cssAssets.get(name)
    if (cached) {
      return cached
    }

    const css = readText(join(this.outDir, 'assets', name))
    if (css === null) {
      return null
    }

    const asset = {
      usage: fontUsage(css),
      siblings: cssAssetReferences(css).filter((sibling) => sibling.endsWith('.css')),
    }

    this.cssAssets.set(name, asset)

    return asset
  }
}
