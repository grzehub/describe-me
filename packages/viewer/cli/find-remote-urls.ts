/** A remote URL found in a text. */
export interface RemoteUrl {
  /** The URL as written. A rewrite replaces it whole. */
  raw: string
  /** The `https:` URL to request. */
  url: string
  /** Offset of `raw` in the text. */
  start: number
  /** Offset just past `raw`. */
  end: number
}

/** How the text is written. Only HTML escapes `&` as `&amp;` inside URLs. */
export type TextSyntax = 'json' | 'css' | 'html'

/**
 * `http://`, `https://` and protocol-relative `//` URLs. A `//` after a word
 * character, `:` or `/` is part of something else, such as `a//b`. A URL ends
 * where JSON, CSS or HTML would end it: `\"` in JSON, `)` in an unquoted
 * `url()`. Google Fonts URLs contain `;`, `&`, `@`, `,` and `:`, so those do not.
 */
const REMOTE_URL = /(?<![\w:/])(?:https?:)?\/\/[^\s"'`\\()<>]+/gi

function requestUrl(raw: string, syntax: TextSyntax): string | null {
  const decoded = syntax === 'html' ? raw.replaceAll('&amp;', '&') : raw
  const scheme = decoded.slice(0, decoded.indexOf('//')).toLowerCase()
  const https = scheme === 'https:' ? decoded : `https:${decoded.slice(scheme.length)}`

  return URL.canParse(https) ? new URL(https).href : null
}

/** Every remote URL in a snapshot, a stylesheet or the preview head, in source order. */
export function findRemoteUrls(text: string, syntax: TextSyntax): RemoteUrl[] {
  const found: RemoteUrl[] = []

  for (const match of text.matchAll(REMOTE_URL)) {
    const url = requestUrl(match[0], syntax)

    if (url !== null) {
      found.push({ raw: match[0], url, start: match.index, end: match.index + match[0].length })
    }
  }

  return found
}
