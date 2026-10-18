import type { FoundationGroup } from '@describe-me/core/types'
import type { FoundationBlock, FoundationItem } from './build-foundations-model.js'

/** A painted value whose element shows `raw`, or `raw → resolved` once the frame resolves it. */
export interface Specimen {
  paint: string
  raw: string
  value: HTMLElement
}

/** What one block needs while it builds. */
interface Build {
  doc: Document
  dark: boolean
  specimens: Specimen[]
}

const LETTERS = 'Aa Bb Cc 0123'
const CAMEL_HUMP = /[A-Z]/g

function make(doc: Document, tag: string, className: string, text?: string): HTMLElement {
  const element = doc.createElement(tag)
  element.className = className

  if (text !== undefined) {
    element.textContent = text
  }

  return element
}

function paintOf(item: FoundationItem, build: Build): string {
  return build.dark ? item.paint.dark : item.paint.light
}

/** The token's element, which every check and test finds by its name. */
function tokenElement(build: Build, item: FoundationItem, tag: string, className: string) {
  const element = make(build.doc, tag, className)
  element.dataset.token = item.name

  return element
}

/** The name, and the value the frame resolves later. */
function labels(build: Build, item: FoundationItem): HTMLElement[] {
  const value = make(build.doc, 'span', 'fd-value')
  const raw = build.dark ? item.raw.dark : item.raw.light
  value.dataset.value = ''
  value.textContent = raw
  build.specimens.push({ paint: paintOf(item, build), raw, value })

  return [make(build.doc, 'span', 'fd-name', item.name), value]
}

/** `style.setProperty()`, so the browser drops a value it cannot use. */
function painted(build: Build, tag: string, className: string, styles: Record<string, string>) {
  const element = make(build.doc, tag, className)
  element.dataset.specimen = ''

  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value)
  }

  return element
}

function listRow(build: Build, item: FoundationItem): HTMLElement {
  const row = tokenElement(build, item, 'div', 'fd-row')
  const meta = make(build.doc, 'div', 'fd-meta')
  meta.append(...labels(build, item))
  row.append(meta)

  return row
}

function showRow(build: Build, item: FoundationItem, show: HTMLElement, extra?: HTMLElement) {
  const row = listRow(build, item)
  const meta = row.firstElementChild!

  if (extra) {
    meta.append(extra)
  }

  const cell = make(build.doc, 'div', 'fd-show')
  cell.append(show)
  row.append(cell)

  return row
}

function swatch(build: Build, item: FoundationItem): HTMLElement {
  const tile = tokenElement(build, item, 'div', 'fd-swatch')
  const chip = painted(build, 'div', 'fd-chip', { 'background-color': paintOf(item, build) })
  tile.append(chip, ...labels(build, item))

  return tile
}

function tile(build: Build, item: FoundationItem, className: string, property: string) {
  const element = tokenElement(build, item, 'div', 'fd-tile')
  const shape = painted(build, 'div', className, { [property]: paintOf(item, build) })
  element.append(shape, ...labels(build, item))

  return element
}

function kebab(property: string): string {
  return property.replace(CAMEL_HUMP, (letter) => `-${letter.toLowerCase()}`)
}

function isFontSize(item: FoundationItem): boolean {
  const named = item.name.startsWith('--text-') || /font-?size/i.test(item.name)

  return item.type === 'dimension' && named
}

function typographyRow(build: Build, item: FoundationItem): HTMLElement {
  const paint = paintOf(item, build)

  if (item.type === 'typography') {
    const parts = item.parts ?? {}
    const styles = Object.fromEntries(
      Object.entries(parts).map(([property, value]) => [kebab(property), value]),
    )

    const list = Object.entries(parts)
      .map(([property, value]) => `${property} ${value}`)
      .join(' · ')

    const sample = painted(build, 'p', 'fd-sample', styles)
    sample.textContent = LETTERS

    return showRow(build, item, sample, make(build.doc, 'span', 'fd-parts', list))
  }

  if (item.type === 'fontFamily' || item.type === 'fontWeight') {
    const property = item.type === 'fontFamily' ? 'font-family' : 'font-weight'
    const sample = painted(build, 'p', 'fd-sample', { [property]: paint })
    sample.textContent = LETTERS

    return showRow(build, item, sample)
  }

  if (isFontSize(item)) {
    const styles: Record<string, string> = { 'font-size': paint }

    if (item.parts?.lineHeight) {
      styles['line-height'] = item.parts.lineHeight
    }

    const sample = painted(build, 'p', 'fd-sample', styles)
    sample.textContent = LETTERS

    return showRow(build, item, sample)
  }

  return listRow(build, item)
}

function shadowTile(build: Build, item: FoundationItem): HTMLElement {
  if (!CSS.supports('box-shadow', paintOf(item, build))) {
    return listRow(build, item)
  }

  return tile(build, item, 'fd-card', 'box-shadow')
}

/** The width of a length in px inside the frame, or 0 for one the frame cannot use. */
function pixels(build: Build, length: string): number {
  const probe = make(build.doc, 'div', 'fd-measure')
  probe.style.setProperty('width', length)
  build.doc.body.append(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()

  return Number.isFinite(width) ? width : 0
}

function breakpointRows(build: Build, items: FoundationItem[]): HTMLElement[] {
  const widths = items.map((item) => pixels(build, paintOf(item, build)))
  const widest = Math.max(0, ...widths)

  return items.map((item, i) => {
    const share = widest > 0 ? ((widths[i] ?? 0) / widest) * 100 : 0
    const bar = painted(build, 'div', 'fd-bar', { width: `${share}%` })

    return showRow(build, item, bar)
  })
}

function container(build: Build, section: FoundationGroup, items: FoundationItem[]) {
  const doc = build.doc

  if (section === 'colors') {
    const grid = make(doc, 'div', 'fd-swatches')
    grid.append(...items.map((item) => swatch(build, item)))

    return grid
  }

  if (section === 'radius' || section === 'shadows') {
    const grid = make(doc, 'div', section === 'shadows' ? 'fd-tiles fd-shadows' : 'fd-tiles')
    const tileOf = (item: FoundationItem) =>
      section === 'shadows' ? shadowTile(build, item) : tile(build, item, 'fd-box', 'border-radius')

    grid.append(...items.map(tileOf))

    return grid
  }

  const rows = make(doc, 'div', 'fd-rows')

  if (section === 'breakpoints') {
    rows.append(...breakpointRows(build, items))
  } else if (section === 'typography') {
    rows.append(...items.map((item) => typographyRow(build, item)))
  } else if (section === 'spacing') {
    rows.append(
      ...items.map((item) =>
        showRow(build, item, painted(build, 'div', 'fd-bar', { width: paintOf(item, build) })),
      ),
    )
  } else {
    rows.append(...items.map((item) => listRow(build, item)))
  }

  return rows
}

/**
 * One block of a section inside the specimen frame: its title and count, then
 * the specimens of the section's kind. Its painted values join `specimens`,
 * for the frame to resolve once everything is in place.
 */
export function renderSpecimenBlock(
  doc: Document,
  section: FoundationGroup,
  block: FoundationBlock,
  dark: boolean,
  specimens: Specimen[],
): HTMLElement {
  const build: Build = { doc, dark, specimens }
  const element = make(doc, 'section', 'fd-block')
  const title = make(doc, 'h2', 'fd-block-title', block.title)
  title.append(make(doc, 'span', 'fd-count', String(block.items.length)))
  element.append(title, container(build, section, block.items))

  return element
}
