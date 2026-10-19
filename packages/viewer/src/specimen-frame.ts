import { applyDarkVariant } from './apply-dark-variant.js'
import type { FoundationSection } from './build-foundations-model.js'
import type { DarkVariant } from './detect-dark-variant.js'
import { filterSpecimens } from './filter-specimens.js'
import { fitFrame } from './fit-frame.js'
import { previewHeadHtml } from './preview-head.js'
import type { ContrastTile } from './show-contrast.js'
import { showContrast } from './show-contrast.js'
import { renderSpecimenBlock } from './specimen-block.js'
import { SpecimenBuild } from './specimen-build.js'
import { SPECIMEN_CSS } from './specimen-css.js'

/** What one specimen frame shows. */
export interface SpecimenOptions {
  section: FoundationSection
  /** Whether the dark variant applies, under `bg=dark`. */
  dark: boolean
  variant: DarkVariant | null
  /** The project's token and font sheets, in load order. */
  css: string[]
  /** The height to start at, the old frame's, so the panel does not jump until the new one is measured. */
  height: number
  /** The names the token filter shows, or `null` for all. */
  shown: ReadonlySet<string> | null
}

/** Constant, as rrweb writes it for replay. Everything else goes in through DOM APIs. */
const SKELETON = '<!doctype html><html><head></head><body></body></html>'

const PROBE_PROPERTY = '--describe-me-probe'
const SPACE = /\s+/g
const SPACE_AROUND_PUNCTUATION = / ?([,()/]) ?/g

function comparable(value: string): string {
  return value
    .replace(SPACE, ' ')
    .replace(SPACE_AROUND_PUNCTUATION, '$1')
    .replaceAll("'", '"')
    .trim()
}

function fillHead(doc: Document, css: string[]): void {
  // The preview head comes first, as in replay, so the project's sheets win ties.
  doc.head.insertAdjacentHTML('afterbegin', previewHeadHtml())

  const project = doc.createElement('style')
  project.textContent = `@layer project {\n${css.join('\n')}\n}`

  const own = doc.createElement('style')
  own.textContent = SPECIMEN_CSS
  doc.head.append(project, own)
}

/**
 * Every painted value as the frame computes it, through one probe. Returns
 * the pair tiles whose two paints both resolve to something.
 */
function showResolved(doc: Document, build: SpecimenBuild): ContrastTile[] {
  const view = doc.defaultView

  if (!view) {
    return []
  }

  const probe = doc.createElement('div')
  probe.className = 'fd-probe'
  doc.body.append(probe)

  const resolve = (paint: string): string => {
    // A value the browser rejects would leave the last one in place.
    probe.style.removeProperty(PROBE_PROPERTY)
    probe.style.setProperty(PROBE_PROPERTY, paint)

    return view.getComputedStyle(probe).getPropertyValue(PROBE_PROPERTY).trim()
  }

  for (const specimen of build.specimens) {
    const resolved = resolve(specimen.paint)

    if (resolved !== '' && comparable(resolved) !== comparable(specimen.raw)) {
      specimen.value.textContent = `${specimen.raw} → ${resolved}`
    }
  }

  const tiles = build.tiles.filter(
    (tile) => resolve(tile.background) !== '' && resolve(tile.foreground) !== '',
  )

  probe.remove()

  return tiles
}

/**
 * Refit whenever the content changes size: a new width, a face that loads
 * late, or the token filter showing samples whose web font only then starts
 * to load. Only the root is observed, because the frame's own height changes
 * with every fit.
 */
function watchContent(iframe: HTMLIFrameElement, root: HTMLElement): void {
  const observer = new ResizeObserver(() => {
    if (!iframe.isConnected) {
      observer.disconnect()
      return
    }

    fitFrame(iframe)
  })

  observer.observe(root)
}

/**
 * Build the specimen frame of one section inside `canvas`, which must be
 * connected. The sandbox runs no script, the project's sheets sit in
 * `@layer project`, and under `bg=dark` the frame gets a dark color scheme and
 * its root the detected class and attribute. The token filter applies before
 * the first fit, and pair tiles get their contrast on `canvas`. The frame fits
 * its height to the content, and again whenever the content changes size.
 */
export function buildSpecimenFrame(
  canvas: HTMLElement,
  options: SpecimenOptions,
): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.title = `Foundations · ${options.section.title}`
  // Set before the frame lays out, so media queries inside never see the viewer's scheme.
  iframe.style.colorScheme = options.dark ? 'dark' : 'light'
  iframe.style.height = `${options.height}px`
  canvas.append(iframe)

  const doc = iframe.contentDocument

  if (!doc) {
    return iframe
  }

  doc.open()
  doc.write(SKELETON)
  doc.close()

  fillHead(doc, options.css)
  applyDarkVariant(doc, options.dark ? options.variant : null)

  const root = doc.createElement('div')
  root.className = 'fd-root'
  root.dataset.section = options.section.id
  doc.body.append(root)

  const build = new SpecimenBuild(doc, options.dark)

  for (const block of options.section.blocks) {
    root.append(renderSpecimenBlock(build, options.section.id, block))
  }

  if (options.shown) {
    filterSpecimens(root, options.shown)
  }

  showContrast(canvas, showResolved(doc, build))
  fitFrame(iframe)
  watchContent(iframe, root)

  return iframe
}
