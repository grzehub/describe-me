import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cssReferences } from '@describe-me/core/css-references'
import type { Manifest, RemoteStylesheet } from '@describe-me/core/types'
import { ASSET_URL_PREFIX, STYLE_URL_PREFIX } from '@describe-me/core/types'

/** A CSS asset's remote `@import` targets and the `.css` siblings it names. */
interface CssAsset {
  remoteImports: string[]
  siblings: string[]
}

/** The files of one count, each read once. */
interface Reader {
  dataDir: string
  /** `@import` targets by chunk hash. */
  chunks: Map<string, string[]>
  cssAssets: Map<string, CssAsset>
  /** Hosts by snapshot path. */
  snapshots: Map<string, string[]>
}

/** The part of an rrweb serialized node that the walk reads. */
interface SerializedNode {
  tagName?: unknown
  textContent?: unknown
  attributes?: Record<string, unknown>
  childNodes?: unknown
}

/** The test server, left out as the reporter leaves it out. */
const TEST_SERVER_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

const REMOTE_URL = /^https?:/i

/** A stored asset's name: a content hash and, when the file has one, its extension. */
const ASSET_NAME = /^[0-9a-f]{16}(\.[a-z0-9]+)?$/

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function parsedJson(json: string | null): unknown {
  if (json === null) {
    return null
  }

  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isRemoteUrl(url: string): boolean {
  return REMOTE_URL.test(url) || url.startsWith('//')
}

function withoutQuery(url: string): string {
  return url.split(/[?#]/)[0]
}

function importsOf(css: string): string[] {
  return cssReferences(css)
    .filter((reference) => reference.kind === 'import')
    .map((reference) => reference.url)
}

function chunkImports(reader: Reader, hash: string): string[] {
  const known = reader.chunks.get(hash)
  if (known !== undefined) {
    return known
  }

  const css = readText(join(reader.dataDir, 'styles', `${hash}.css`))
  const imports = css === null ? [] : importsOf(css)
  reader.chunks.set(hash, imports)

  return imports
}

function cssAsset(reader: Reader, name: string): CssAsset {
  const known = reader.cssAssets.get(name)
  if (known !== undefined) {
    return known
  }

  const css = readText(join(reader.dataDir, 'assets', name)) ?? ''
  const asset = {
    remoteImports: importsOf(css).filter(isRemoteUrl),
    siblings: cssReferences(css)
      .map((reference) => withoutQuery(reference.url))
      .filter((sibling) => ASSET_NAME.test(sibling) && sibling.endsWith('.css')),
  }

  reader.cssAssets.set(name, asset)

  return asset
}

function isNode(value: unknown): value is SerializedNode {
  return typeof value === 'object' && value !== null
}

function childrenOf(node: SerializedNode): SerializedNode[] {
  return Array.isArray(node.childNodes) ? node.childNodes.filter(isNode) : []
}

function isStylesheetLink(node: SerializedNode, attributes: Record<string, unknown>): boolean {
  const rel = attributes.rel

  return (
    node.tagName === 'link' &&
    typeof rel === 'string' &&
    rel.toLowerCase().split(/\s+/).includes('stylesheet')
  )
}

function cssTextImports(reader: Reader, cssText: string): string[] {
  if (!cssText.startsWith(STYLE_URL_PREFIX)) {
    return importsOf(cssText)
  }

  const hashes = cssText.slice(STYLE_URL_PREFIX.length).split('+')

  return hashes.flatMap((hash) => chunkImports(reader, hash))
}

/**
 * Add the `@import` targets and stylesheet links of a node and everything
 * below it. rrweb keeps shadow roots and iframe documents among the child
 * nodes, so they are read too.
 */
function addTargets(reader: Reader, node: SerializedNode, targets: string[]): void {
  const attributes = isNode(node.attributes) ? node.attributes : {}
  const { _cssText: cssText, href } = attributes

  if (typeof cssText === 'string') {
    targets.push(...cssTextImports(reader, cssText))
  } else if (isStylesheetLink(node, attributes) && typeof href === 'string') {
    targets.push(href)
  }

  const children = childrenOf(node)

  // rrweb writes the text of a `<style>` only when it could not read the sheet.
  if (node.tagName === 'style') {
    for (const child of children) {
      if (typeof child.textContent === 'string' && child.textContent.trim() !== '') {
        targets.push(...importsOf(child.textContent))
      }
    }
  }

  for (const child of children) {
    addTargets(reader, child, targets)
  }
}

function hostOf(url: string): string | null {
  const absolute = url.startsWith('//') ? `https:${url}` : url

  return URL.canParse(absolute) ? new URL(absolute).hostname : null
}

/** The hosts of the remote stylesheets that targets reach, through CSS assets too. */
function reachedHosts(reader: Reader, targets: string[]): string[] {
  const remoteUrls: string[] = []
  const pending: string[] = []
  const seen = new Set<string>()

  const follow = (url: string) => {
    if (isRemoteUrl(url)) {
      remoteUrls.push(url)
    } else if (url.startsWith(ASSET_URL_PREFIX)) {
      pending.push(withoutQuery(url.slice(ASSET_URL_PREFIX.length)))
    }
  }

  targets.forEach(follow)

  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (seen.has(name) || !name.endsWith('.css')) {
      continue
    }

    seen.add(name)
    const asset = cssAsset(reader, name)
    remoteUrls.push(...asset.remoteImports)
    pending.push(...asset.siblings)
  }

  const hosts = new Set<string>()
  for (const url of remoteUrls) {
    const host = hostOf(url)
    if (host && !TEST_SERVER_HOSTS.has(host)) {
      hosts.add(host)
    }
  }

  return [...hosts]
}

function snapshotHosts(reader: Reader, file: string): string[] {
  const known = reader.snapshots.get(file)
  if (known !== undefined) {
    return known
  }

  const node = parsedJson(readText(join(reader.dataDir, file)))
  const targets: string[] = []
  if (isNode(node)) {
    addTargets(reader, node, targets)
  }

  const hosts = reachedHosts(reader, targets)
  reader.snapshots.set(file, hosts)

  return hosts
}

/**
 * The hosts that frames load stylesheets from, most frames first, counted
 * from the files on disk by the rules of the reporter's `FontAudit`. It is a
 * copy, because the viewer cannot depend on the reporter's package.
 */
export function remoteStylesheets(dataDir: string, manifest: Manifest): RemoteStylesheet[] {
  const reader: Reader = { dataDir, chunks: new Map(), cssAssets: new Map(), snapshots: new Map() }
  const frames = new Map<string, number>()
  const snapshots = manifest.modules.flatMap((mod) => {
    return mod.tests.flatMap((test) => test.frames.map((frame) => frame.snapshot))
  })

  for (const snapshot of snapshots) {
    for (const host of snapshotHosts(reader, snapshot)) {
      frames.set(host, (frames.get(host) ?? 0) + 1)
    }
  }

  return Array.from(frames, ([host, count]) => ({ host, frames: count })).sort(
    (left, right) => right.frames - left.frames || left.host.localeCompare(right.host),
  )
}
