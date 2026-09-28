import { STYLE_URL_PREFIX } from '@describe-me/core/types'

/** The CSS a serialized snapshot carries, and the stylesheets it links. */
export interface SnapshotStyles {
  /** `_cssText` values that are not style references, and the text of `<style>` elements. */
  cssTexts: string[]
  /** The chunk hashes of `describe-me-style:` references, in order. */
  chunks: string[]
  /** `style` attribute values. */
  styleAttributes: string[]
  /** The `href` of each `<link rel="stylesheet">` that rrweb did not inline. */
  stylesheetLinks: string[]
}

/** The part of an rrweb serialized node that the walk reads. */
interface SerializedNode {
  tagName?: unknown
  textContent?: unknown
  attributes?: Record<string, unknown>
  childNodes?: unknown
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

function addCssText(styles: SnapshotStyles, cssText: string): void {
  if (cssText.startsWith(STYLE_URL_PREFIX)) {
    styles.chunks.push(...cssText.slice(STYLE_URL_PREFIX.length).split('+'))
  } else {
    styles.cssTexts.push(cssText)
  }
}

/** rrweb writes the text of a `<style>` only when it could not read the sheet. */
function addStyleText(styles: SnapshotStyles, node: SerializedNode): void {
  for (const child of childrenOf(node)) {
    if (typeof child.textContent === 'string' && child.textContent.trim() !== '') {
      styles.cssTexts.push(child.textContent)
    }
  }
}

function visit(node: SerializedNode, styles: SnapshotStyles): void {
  const attributes = isNode(node.attributes) ? node.attributes : {}
  const { _cssText: cssText, style, href } = attributes

  if (typeof cssText === 'string') {
    addCssText(styles, cssText)
  } else if (isStylesheetLink(node, attributes) && typeof href === 'string') {
    styles.stylesheetLinks.push(href)
  }

  if (typeof style === 'string') {
    styles.styleAttributes.push(style)
  }

  if (node.tagName === 'style') {
    addStyleText(styles, node)
  }

  for (const child of childrenOf(node)) {
    visit(child, styles)
  }
}

/**
 * Collect the CSS of an rrweb serialized node and everything below it. rrweb
 * keeps shadow roots and iframe documents among the child nodes, so they are
 * read too.
 */
export function snapshotStyles(node: unknown): SnapshotStyles {
  const styles: SnapshotStyles = {
    cssTexts: [],
    chunks: [],
    styleAttributes: [],
    stylesheetLinks: [],
  }

  if (isNode(node)) {
    visit(node, styles)
  }

  return styles
}
