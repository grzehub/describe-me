import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { STYLE_URL_PREFIX, type FoundationsSheet } from '@describe-me/core/types'
import { rootCustomProperties } from './root-custom-properties.js'

/** What the kept snapshots say about the project's stylesheets. */
export interface RecordedSheetsResult {
  /** Sheets with root custom properties, in first-appearance order. */
  tokenSheets: FoundationsSheet[]
  /** Sheets with `@font-face`, in first-appearance order. */
  fontSheets: FoundationsSheet[]
  /** Project CSS files the frames load, relative to the root. */
  cssSources: string[]
  /** The distinct root custom properties of the token sheets. */
  rootNames: string[]
}

/** An element of a snapshot that holds a sheet or names a Vite module. */
interface RecordedElement {
  cssText?: string
  devId?: string
}

/** What a sheet's text holds, read once per distinct `_cssText`. */
interface SheetContents {
  rootNames: string[]
  fontFace: boolean
}

/** One walk over the snapshots: what it found so far, and each sheet it read. */
interface SheetsRun {
  tokenSheets: FoundationsSheet[]
  fontSheets: FoundationsSheet[]
  contents: Map<string, SheetContents | null>
  sources: Set<string>
  rootNames: Set<string>
}

/** rrweb's `NodeType.Element`. */
const ELEMENT_NODE = 2

const DEV_ID = 'data-vite-dev-id'

const STYLE_REFERENCE = new RegExp(`^${STYLE_URL_PREFIX}([0-9a-f]{16}(?:\\+[0-9a-f]{16})*)$`)

const CSS_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.styl', '.pcss', '.postcss'])

const FONT_FACE = /@font-face\b/i

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A project file with a CSS extension, once its `?query` is cut off: no package, nothing outside the root. */
function isProjectCssSource(devId: string): boolean {
  const file = devId.split('?')[0]
  const dot = file.lastIndexOf('.')

  if (file.startsWith('..') || file.startsWith('/') || /^[A-Za-z]:/.test(file)) {
    return false
  }

  if (file.split(/[\\/]/).includes('node_modules')) {
    return false
  }

  return dot !== -1 && CSS_EXTENSIONS.has(file.slice(dot).toLowerCase())
}

/** Shadow roots and iframe documents are among the child nodes, so a depth-first walk keeps document order. */
function collectElements(node: unknown, found: RecordedElement[]): void {
  if (!isObject(node)) {
    return
  }

  if (node.type === ELEMENT_NODE && isObject(node.attributes)) {
    const { _cssText: cssText, [DEV_ID]: devId } = node.attributes

    if (typeof cssText === 'string' || typeof devId === 'string') {
      found.push({
        cssText: typeof cssText === 'string' ? cssText : undefined,
        devId: typeof devId === 'string' ? devId : undefined,
      })
    }
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      collectElements(child, found)
    }
  }
}

/**
 * The stylesheets of the kept snapshots, as the Foundations view needs them:
 * those with root custom properties, those with `@font-face` and the project
 * CSS files the frames load.
 */
export class RecordedSheets {
  private readonly outDir: string
  /** Snapshots are content-addressed, so a cached entry never goes stale. */
  private readonly elementsBySnapshot = new Map<string, RecordedElement[]>()

  constructor(outDir: string) {
    this.outDir = outDir
  }

  /** Walk the snapshots in manifest order. Each distinct sheet is read once. */
  read(snapshotFiles: Iterable<string>): RecordedSheetsResult {
    const run: SheetsRun = {
      tokenSheets: [],
      fontSheets: [],
      contents: new Map(),
      sources: new Set(),
      rootNames: new Set(),
    }

    for (const snapshotFile of snapshotFiles) {
      for (const element of this.elementsIn(snapshotFile)) {
        this.readElement(run, element)
      }
    }

    return {
      tokenSheets: run.tokenSheets,
      fontSheets: run.fontSheets,
      cssSources: [...run.sources],
      rootNames: [...run.rootNames],
    }
  }

  private readElement(run: SheetsRun, element: RecordedElement): void {
    if (element.devId !== undefined && isProjectCssSource(element.devId)) {
      run.sources.add(element.devId.split('?')[0])
    }

    if (element.cssText === undefined || run.contents.has(element.cssText)) {
      return
    }

    const sheet = this.contentsOf(element.cssText)
    run.contents.set(element.cssText, sheet)

    if (sheet === null) {
      return
    }

    const recorded: FoundationsSheet = { cssText: element.cssText }

    if (element.devId !== undefined) {
      recorded.source = element.devId
    }

    if (sheet.rootNames.length > 0) {
      run.tokenSheets.push(recorded)

      for (const name of sheet.rootNames) {
        run.rootNames.add(name)
      }
    }

    if (sheet.fontFace) {
      run.fontSheets.push(recorded)
    }
  }

  /** Null for a stored sheet with a missing chunk, which the garbage collection just kept. */
  private contentsOf(cssText: string): SheetContents | null {
    const css = this.textOf(cssText)

    if (css === null) {
      return null
    }

    return { rootNames: rootCustomProperties(css), fontFace: FONT_FACE.test(css) }
  }

  /** The sheet's CSS: its stored chunks joined in order, or the inline text. */
  private textOf(cssText: string): string | null {
    const reference = STYLE_REFERENCE.exec(cssText)

    if (reference === null) {
      return cssText
    }

    let css = ''

    for (const hash of reference[1].split('+')) {
      const chunk = join(this.outDir, 'styles', `${hash}.css`)

      if (!existsSync(chunk)) {
        return null
      }

      css += readFileSync(chunk, 'utf8')
    }

    return css
  }

  private elementsIn(snapshotFile: string): RecordedElement[] {
    const cached = this.elementsBySnapshot.get(snapshotFile)

    if (cached) {
      return cached
    }

    const path = join(this.outDir, snapshotFile)

    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      return []
    }

    const json = readFileSync(path, 'utf8')
    const found: RecordedElement[] = []

    if (json.includes('"_cssText"') || json.includes(`"${DEV_ID}"`)) {
      collectElements(JSON.parse(json), found)
    }

    this.elementsBySnapshot.set(snapshotFile, found)

    return found
  }
}
