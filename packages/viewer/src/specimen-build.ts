import type { FoundationItem } from './build-foundations-model.js'
import type { ContrastTile } from './show-contrast.js'

/** A painted value whose element shows `raw`, or `raw → resolved` once the frame resolves it. */
export interface Specimen {
  paint: string
  raw: string
  value: HTMLElement
}

/**
 * What the blocks of one specimen frame share while they build: the frame's
 * document, its color scheme, the elements every layout uses, and the values
 * and pair tiles that the frame resolves once everything is in place.
 */
export class SpecimenBuild {
  readonly doc: Document
  readonly dark: boolean
  readonly specimens: Specimen[] = []
  readonly tiles: ContrastTile[] = []

  constructor(doc: Document, dark: boolean) {
    this.doc = doc
    this.dark = dark
  }

  make(tag: string, className: string, text?: string): HTMLElement {
    const element = this.doc.createElement(tag)
    element.className = className

    if (text !== undefined) {
      element.textContent = text
    }

    return element
  }

  paintOf(item: FoundationItem): string {
    return this.dark ? item.paint.dark : item.paint.light
  }

  rawOf(item: FoundationItem): string {
    return this.dark ? item.raw.dark : item.raw.light
  }

  /** Whether the item is a framework default in the color scheme on screen. */
  isDefault(item: FoundationItem): boolean {
    const scheme = this.dark ? 'dark' : 'light'
    const origin = item.modeOrigins?.[scheme] ?? item.origin

    return origin === 'default'
  }

  /** The token's element, which every check and test finds by its name. */
  tokenElement(item: FoundationItem, tag: string, className: string): HTMLElement {
    const element = this.make(tag, className)
    element.dataset.token = item.name

    if (this.isDefault(item)) {
      element.setAttribute('data-origin', 'default')
    }

    return element
  }

  badge(): HTMLElement {
    return this.make('span', 'fd-badge', 'default')
  }

  /** The value, which the frame resolves later. */
  value(item: FoundationItem): HTMLElement {
    const value = this.make('span', 'fd-value')
    const raw = this.rawOf(item)
    value.dataset.value = ''
    value.textContent = raw
    this.specimens.push({ paint: this.paintOf(item), raw, value })

    return value
  }

  /** The name, a badge on a framework default, and the value. */
  labels(item: FoundationItem): HTMLElement[] {
    const name = this.make('span', 'fd-name', item.name)
    const badge = this.isDefault(item) ? [this.badge()] : []

    return [name, ...badge, this.value(item)]
  }

  /** `style.setProperty()`, so the browser drops a value it cannot use. */
  painted(tag: string, className: string, styles: Record<string, string>): HTMLElement {
    const element = this.make(tag, className)
    element.dataset.specimen = ''

    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value)
    }

    return element
  }

  /** The width of a length in px inside the frame, or 0 for one the frame cannot use. */
  pixels(length: string): number {
    const probe = this.make('div', 'fd-measure')
    probe.style.setProperty('width', length)
    this.doc.body.append(probe)
    const width = probe.getBoundingClientRect().width
    probe.remove()

    return Number.isFinite(width) ? width : 0
  }

  listRow(item: FoundationItem): HTMLElement {
    const row = this.tokenElement(item, 'div', 'fd-row')
    const meta = this.make('div', 'fd-meta')
    meta.append(...this.labels(item))
    row.append(meta)

    return row
  }

  showRow(item: FoundationItem, show: HTMLElement, extra?: HTMLElement): HTMLElement {
    const row = this.listRow(item)
    const meta = row.firstElementChild!

    if (extra) {
      meta.append(extra)
    }

    const cell = this.make('div', 'fd-show')
    cell.append(show)
    row.append(cell)

    return row
  }

  swatch(item: FoundationItem): HTMLElement {
    const tile = this.tokenElement(item, 'div', 'fd-swatch')
    const chip = this.painted('div', 'fd-chip', { 'background-color': this.paintOf(item) })
    tile.append(chip, ...this.labels(item))

    return tile
  }

  tile(item: FoundationItem, className: string, property: string, value = this.paintOf(item)) {
    const element = this.tokenElement(item, 'div', 'fd-tile')
    const shape = this.painted('div', className, { [property]: value })
    element.append(shape, ...this.labels(item))

    return element
  }
}
