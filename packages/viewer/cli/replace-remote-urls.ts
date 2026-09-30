import type { TextSyntax } from './find-remote-urls.js'
import { findRemoteUrls } from './find-remote-urls.js'

/**
 * The text with `prefix` and the stored name written in place of every remote
 * URL that `names` maps, left to right. Other URLs stay as written.
 */
export function replaceRemoteUrls(
  text: string,
  syntax: TextSyntax,
  prefix: string,
  names: Map<string, string>,
): string {
  const parts: string[] = []
  let last = 0

  for (const match of findRemoteUrls(text, syntax)) {
    const name = names.get(match.url)
    if (name !== undefined) {
      parts.push(text.slice(last, match.start), `${prefix}${name}`)
      last = match.end
    }
  }

  parts.push(text.slice(last))

  return parts.join('')
}
