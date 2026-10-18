import type { FoundationSection } from './build-foundations-model.js'
import type { DarkVariant } from './detect-dark-variant.js'
import { fontsSettled } from './fonts-settled.js'
import { previewHeadHtml } from './preview-head.js'
import { SPECIMEN_CSS } from './specimen-css.js'
import type { Specimen } from './specimen-block.js'
import { renderSpecimenBlock } from './specimen-block.js'

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

function applyVariant(doc: Document, options: SpecimenOptions): void {
  const root = doc.documentElement

  if (!options.dark || !options.variant) {
    return
  }

  if (options.variant.className) {
    root.classList.add(options.variant.className)
  }

  if (options.variant.attribute) {
    root.setAttribute(options.variant.attribute.name, options.variant.attribute.value)
  }
}

/** Every painted value as the frame computes it, through one probe. */
function showResolved(doc: Document, specimens: Specimen[]): void {
  const view = doc.defaultView

  if (!view) {
    return
  }

  const probe = doc.createElement('div')
  probe.className = 'fd-probe'
  doc.body.append(probe)

  for (const specimen of specimens) {
    // A value the browser rejects would leave the last one in place.
    probe.style.removeProperty(PROBE_PROPERTY)
    probe.style.setProperty(PROBE_PROPERTY, specimen.paint)
    const resolved = view.getComputedStyle(probe).getPropertyValue(PROBE_PROPERTY).trim()

    if (resolved !== '' && comparable(resolved) !== comparable(specimen.raw)) {
      specimen.value.textContent = `${specimen.raw} → ${resolved}`
    }
  }

  probe.remove()
}

/**
 * Fit the frame to its content's bottom edge. `scrollHeight` cannot measure
 * it, because it never reports less than the frame's own height.
 */
function fit(iframe: HTMLIFrameElement, root: HTMLElement): void {
  if (!iframe.isConnected) {
    return
  }

  iframe.style.height = `${Math.ceil(root.getBoundingClientRect().bottom)}px`
}

function watchWidth(iframe: HTMLIFrameElement, root: HTMLElement): void {
  let width = iframe.getBoundingClientRect().width

  const observer = new ResizeObserver(() => {
    if (!iframe.isConnected) {
      observer.disconnect()
      return
    }

    const next = iframe.getBoundingClientRect().width

    if (next !== width) {
      width = next
      fit(iframe, root)
    }
  })

  observer.observe(iframe)
}

/**
 * Build the specimen frame of one section inside `canvas`, which must be
 * connected. The sandbox runs no script, the project's sheets sit in
 * `@layer project`, and under `bg=dark` the frame gets a dark color scheme and
 * its root the detected class and attribute. The frame fits its height to the
 * content, again once fonts settle and whenever its width changes.
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
  applyVariant(doc, options)

  const root = doc.createElement('div')
  root.className = 'fd-root'
  root.dataset.section = options.section.id
  doc.body.append(root)

  const specimens: Specimen[] = []

  for (const block of options.section.blocks) {
    root.append(renderSpecimenBlock(doc, options.section.id, block, options.dark, specimens))
  }

  const fonts = fontsSettled(iframe)
  showResolved(doc, specimens)
  fit(iframe, root)
  void fonts.then(() => fit(iframe, root))
  watchWidth(iframe, root)

  return iframe
}
