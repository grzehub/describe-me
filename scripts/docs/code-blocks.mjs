import { decodeEntities } from './decode-entities.mjs'
import { stripTags } from './strip-tags.mjs'

const CODE_BLOCK = /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code\s*>\s*<\/pre\s*>/gi

/** The text of every `<pre><code>` block of a page, as a reader would copy it. */
export function codeBlocks(html) {
  return [...html.matchAll(CODE_BLOCK)].map((match) => decodeEntities(stripTags(match[1])))
}
