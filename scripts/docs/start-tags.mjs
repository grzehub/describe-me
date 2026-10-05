// A start tag: quoted attribute values may hold `>`. The three alternatives start with
// different characters, so the pattern never backtracks.
const START_TAG = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g

/**
 * Every start tag of a page in source order: its lower-case name, its attributes
 * (names lower-cased, values as written, entities not decoded), and where it starts.
 * Text in code blocks is escaped, so only real tags count.
 */
export function startTags(html) {
  const tags = []

  for (const match of html.matchAll(START_TAG)) {
    const attributes = {}

    for (const attribute of match[2].matchAll(ATTRIBUTE)) {
      attributes[attribute[1].toLowerCase()] = attribute[2] ?? attribute[3] ?? attribute[4] ?? ''
    }

    tags.push({
      name: match[1].toLowerCase(),
      attributes,
      index: match.index,
      end: match.index + match[0].length,
    })
  }

  return tags
}
