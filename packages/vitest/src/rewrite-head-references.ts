import { rewriteCssReferences } from './rewrite-css-references.js'

type Resolve = (url: string) => string | null

/**
 * Comments and `<script>` elements, which stay as written, and `<style>`
 * elements, whose CSS is rewritten. Tags between them are rewritten attribute
 * by attribute.
 */
const RAW_TEXT =
  /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi

/** A start tag, split after its name. Quoted attribute values may contain `>`. */
const START_TAG = /(<[a-z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*>)/gi

/**
 * One attribute: its whole name, so `data-src` is never `src`, and its value,
 * double-quoted, single-quoted or bare.
 */
const ATTRIBUTE = /([^\s"'<>/=]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g

/** Attributes whose value is a URL, and `style`, whose value is CSS. */
const REWRITTEN_ATTRIBUTES = new Set(['href', 'src', 'style'])

function rewriteAttribute(
  attribute: string,
  name: string,
  equals: string | undefined,
  value: string | undefined,
  resolve: Resolve,
): string {
  const kind = name.toLowerCase()
  if (equals === undefined || value === undefined || !REWRITTEN_ATTRIBUTES.has(kind)) {
    return attribute
  }

  const quote = value.startsWith('"') || value.startsWith("'") ? value[0] : ''
  const text = quote === '' ? value : value.slice(1, -1)
  const rewritten = kind === 'style' ? rewriteCssReferences(text, resolve) : (resolve(text) ?? text)

  return `${name}${equals}${quote}${rewritten}${quote}`
}

function rewriteTags(html: string, resolve: Resolve): string {
  return html.replace(START_TAG, (_tag, name: string, attributes: string) => {
    const rewritten = attributes.replace(
      ATTRIBUTE,
      (attribute: string, attributeName: string, equals?: string, value?: string) =>
        rewriteAttribute(attribute, attributeName, equals, value, resolve),
    )

    return name + rewritten
  })
}

/**
 * Replace the URLs in HTML meant for a document's `<head>`: `href` and `src`
 * values, and the `url()` and `@import` targets of `<style>` elements and
 * `style` attributes, wherever `resolve` returns a string.
 */
export function rewriteHeadReferences(html: string, resolve: Resolve): string {
  let rewritten = ''
  let copied = 0

  for (const match of html.matchAll(RAW_TEXT)) {
    const [text, styleStart, css, styleEnd] = match
    const kept =
      styleStart === undefined ? text : styleStart + rewriteCssReferences(css, resolve) + styleEnd

    rewritten += rewriteTags(html.slice(copied, match.index), resolve) + kept
    copied = match.index + text.length
  }

  return rewritten + rewriteTags(html.slice(copied), resolve)
}
