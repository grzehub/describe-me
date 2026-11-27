import { createHash } from 'node:crypto'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** rrweb writes the CSS of a `<style>` as its text only when it could not read the sheet. */
function withoutStylesheetText(node: unknown, inStyle: boolean): unknown {
  if (!isObject(node)) {
    return node
  }

  const copy: Record<string, unknown> = { ...node }

  if (isObject(node.attributes) && '_cssText' in node.attributes) {
    const attributes = { ...node.attributes }
    delete attributes._cssText
    copy.attributes = attributes
  }

  if (inStyle && typeof node.textContent === 'string') {
    copy.textContent = ''
  }

  if (Array.isArray(node.childNodes)) {
    const isStyle = node.tagName === 'style'
    copy.childNodes = node.childNodes.map((child: unknown) => withoutStylesheetText(child, isStyle))
  }

  return copy
}

/**
 * A key of a parsed rrweb snapshot that leaves out the stylesheet text: every
 * `_cssText`, inline or a `describe-me-style:` reference, and the text of a
 * `<style>`. Two snapshots with the same key differ at most in their CSS.
 */
export function snapshotDomKey(snapshot: unknown): string {
  const json = JSON.stringify(withoutStylesheetText(snapshot, false))

  return createHash('sha1').update(json).digest('hex')
}
