import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CssReference } from '@describe-me/core/css-references'
import { cssReferences } from '@describe-me/core/css-references'
import { ASSET_URL_PREFIX, STYLE_URL_PREFIX } from '@describe-me/core/types'
import { fileNamesIn } from './file-names-in.js'
import { replaceAssetNames } from './replace-asset-names.js'
import { replaceRemoteUrls } from './replace-remote-urls.js'
import { storeVendoredFile } from './store-vendored-file.js'

/** What a data directory held before the downloads, and what they stored. */
export interface StoredFilesInput {
  /** The stored name for each vendored URL. */
  names: Map<string, string>
  /** Names of the `assets/*.css` files before the downloads. Only these may change. */
  cssAssets: string[]
  /** Paths of the texts in which the scan found a URL to vendor. */
  kept: Set<string>
  /** Names of the files stored in this run. Their names are final. */
  vendored: Set<string>
}

/** What the rewrite changed. */
export interface RewrittenFiles {
  /** Old → new name of each CSS asset stored under a new name. */
  assetRenames: Map<string, string>
  /** Whether a snapshot, style chunk or CSS asset changed. */
  changed: boolean
  /** Paths of the files that renamed ones replace, to remove once nothing names them. */
  replaced: string[]
}

/** The files of one directory that changed, and which of them moved. */
interface Rewritten {
  /** Old → new file name. */
  renames: Map<string, string>
  changed: boolean
}

/** The CSS assets of one rewrite, each resolved once. */
interface CssAssetRun {
  dir: string
  names: Map<string, string>
  /** The CSS assets that existed before the downloads, less those stored in this run. */
  listed: Set<string>
  /** The name each resolved CSS asset ends up with. */
  finalNames: Map<string, string>
  /** The CSS assets being resolved further up the stack. */
  resolving: Set<string>
  changed: boolean
}

/** A name that the style and asset stores gave: the sha1-16 of the text. */
const CONTENT_NAME = /^[0-9a-f]{16}\.css$/

const STYLE_REFERENCE = new RegExp(`${STYLE_URL_PREFIX}([0-9a-f]{16}(?:\\+[0-9a-f]{16})*)`, 'g')

/**
 * Write a changed text. A content-named file moves to the hash of its new
 * bytes, written only when missing, so identical texts share one file. Any
 * other file keeps its name.
 */
function storeText(dir: string, name: string, text: string): string {
  if (!CONTENT_NAME.test(name)) {
    writeFileSync(join(dir, name), text)

    return name
  }

  return storeVendoredFile(dir, new TextEncoder().encode(text), '.css')
}

/** The CSS with each target replaced from the end, so earlier offsets stay valid. */
function replaceReferences(css: string, replacements: [CssReference, string][]): string {
  let rewritten = css

  for (const [reference, replacement] of [...replacements].reverse()) {
    rewritten = rewritten.slice(0, reference.start) + replacement + rewritten.slice(reference.end)
  }

  return rewritten
}

/** Each bare `.css` sibling that moved, with its query and fragment kept. */
function siblingReplacements(run: CssAssetRun, css: string): [CssReference, string][] {
  return cssReferences(css).flatMap((reference): [CssReference, string][] => {
    const name = reference.url.split(/[?#]/)[0]
    if (!CONTENT_NAME.test(name)) {
      return []
    }

    const finalName = resolveCssAsset(run, name)
    if (finalName === name) {
      return []
    }

    return [[reference, `${finalName}${reference.url.slice(name.length)}`]]
  })
}

function rewriteCssAsset(run: CssAssetRun, name: string): string {
  const css = readFileSync(join(run.dir, name), 'utf8')
  const vendored = replaceRemoteUrls(css, 'css', '', run.names)
  const rewritten = replaceReferences(vendored, siblingReplacements(run, vendored))

  if (rewritten === css) {
    return name
  }

  run.changed = true

  return storeText(run.dir, name, rewritten)
}

/** The name a CSS asset ends up with, its siblings resolved first. */
function resolveCssAsset(run: CssAssetRun, name: string): string {
  const known = run.finalNames.get(name)
  if (known !== undefined) {
    return known
  }

  if (!run.listed.has(name)) {
    return name
  }

  // Content hashes cannot form a cycle, so this only stops a hand-made one.
  if (run.resolving.has(name)) {
    return name
  }

  run.resolving.add(name)
  const finalName = rewriteCssAsset(run, name)
  run.resolving.delete(name)
  run.finalNames.set(name, finalName)

  return finalName
}

function rewriteCssAssets(dataDir: string, input: StoredFilesInput): Rewritten {
  const run: CssAssetRun = {
    dir: join(dataDir, 'assets'),
    names: input.names,
    listed: new Set(input.cssAssets.filter((name) => !input.vendored.has(name))),
    finalNames: new Map(),
    resolving: new Set(),
    changed: false,
  }

  for (const name of run.listed) {
    resolveCssAsset(run, name)
  }

  const renames = new Map([...run.finalNames].filter(([name, finalName]) => finalName !== name))

  return { renames, changed: run.changed }
}

function rewriteChunks(
  dataDir: string,
  input: StoredFilesInput,
  assetRenames: Map<string, string>,
): Rewritten {
  const dir = join(dataDir, 'styles')
  const result: Rewritten = { renames: new Map(), changed: false }

  for (const name of fileNamesIn(dir, '.css')) {
    const path = join(dir, name)
    if (assetRenames.size === 0 && !input.kept.has(path)) {
      continue
    }

    const css = readFileSync(path, 'utf8')
    const vendored = replaceRemoteUrls(css, 'css', ASSET_URL_PREFIX, input.names)
    const rewritten = replaceAssetNames(vendored, assetRenames)

    if (rewritten !== css) {
      result.changed = true
      const stored = storeText(dir, name, rewritten)
      if (stored !== name) {
        result.renames.set(name, stored)
      }
    }
  }

  return result
}

/** Each renamed hash inside a `describe-me-style:` reference, in the order written. */
function replaceChunkHashes(json: string, renames: Map<string, string>): string {
  if (renames.size === 0) {
    return json
  }

  return json.replace(STYLE_REFERENCE, (_reference: string, hashes: string) => {
    const renamed = hashes.split('+').map((hash) => renames.get(hash) ?? hash)

    return `${STYLE_URL_PREFIX}${renamed.join('+')}`
  })
}

function hashRenames(chunkRenames: Map<string, string>): Map<string, string> {
  const hashOf = (name: string) => name.slice(0, -'.css'.length)

  return new Map([...chunkRenames].map(([name, renamed]) => [hashOf(name), hashOf(renamed)]))
}

/** Snapshots keep their names, because the viewer always fetches them fresh. */
function rewriteSnapshots(
  dataDir: string,
  input: StoredFilesInput,
  assetRenames: Map<string, string>,
  chunkRenames: Map<string, string>,
): boolean {
  const dir = join(dataDir, 'snapshots')
  const readAll = assetRenames.size > 0 || chunkRenames.size > 0
  const chunkHashes = hashRenames(chunkRenames)
  let changed = false

  for (const name of fileNamesIn(dir, '.json')) {
    const path = join(dir, name)
    if (!readAll && !input.kept.has(path)) {
      continue
    }

    const json = readFileSync(path, 'utf8')
    const vendored = replaceRemoteUrls(json, 'json', ASSET_URL_PREFIX, input.names)
    const rewritten = replaceChunkHashes(replaceAssetNames(vendored, assetRenames), chunkHashes)

    if (rewritten !== json) {
      writeFileSync(path, rewritten)
      changed = true
    }
  }

  return changed
}

/** The old files that no new name reuses. */
function replacedPaths(dir: string, renames: Map<string, string>, vendored: Set<string>): string[] {
  const finalNames = new Set(renames.values())

  return [...renames.keys()]
    .filter((name) => !finalNames.has(name) && !vendored.has(name))
    .map((name) => join(dir, name))
}

/**
 * Point the CSS assets, style chunks and snapshots of a data directory at the
 * vendored files, in that order. A changed CSS asset or chunk moves to the
 * hash of its new text before anything that names it changes. The files it
 * replaces stay until the caller removes them.
 */
export function rewriteStoredFiles(dataDir: string, input: StoredFilesInput): RewrittenFiles {
  if (input.names.size === 0) {
    return { assetRenames: new Map(), changed: false, replaced: [] }
  }

  const assets = rewriteCssAssets(dataDir, input)
  const chunks = rewriteChunks(dataDir, input, assets.renames)
  const snapshotsChanged = rewriteSnapshots(dataDir, input, assets.renames, chunks.renames)

  return {
    assetRenames: assets.renames,
    changed: assets.changed || chunks.changed || snapshotsChanged,
    replaced: [
      ...replacedPaths(join(dataDir, 'assets'), assets.renames, input.vendored),
      ...replacedPaths(join(dataDir, 'styles'), chunks.renames, new Set()),
    ],
  }
}
