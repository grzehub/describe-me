// The same patterns as RAW_TEXT, START_TAG and ATTRIBUTE in rewrite-head-references.ts.
const RAW_TEXT =
  /<!--[\s\S]*?--!?>|<script\b[\s\S]*?<\/script\b[^>]*>|(<style\b[^>]*>)([\s\S]*?)(<\/style\b[^>]*>)/gi

const START_TAG = /(<[a-z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*>)/gi
const ATTRIBUTE = /([^\s"'<>/=]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g

/** The attributes of a start tag by lowercase name, unquoted and with `&amp;` decoded. */
function attributesOf(text: string): Map<string, string> {
  const attributes = new Map<string, string>()

  for (const [, name, , value] of text.matchAll(ATTRIBUTE)) {
    if (value === undefined) {
      continue
    }

    const quoted = value.startsWith('"') || value.startsWith("'")
    const unquoted = quoted ? value.slice(1, -1) : value
    attributes.set(name.toLowerCase(), unquoted.replaceAll('&amp;', '&'))
  }

  return attributes
}

function stylesheetLinksIn(html: string): string[] {
  const links: string[] = []

  for (const [, name, text] of html.matchAll(START_TAG)) {
    if (name.slice(1).toLowerCase() !== 'link') {
      continue
    }

    const attributes = attributesOf(text)
    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/)
    const href = attributes.get('href')

    if (rel.includes('stylesheet') && href !== undefined) {
      links.push(href)
    }
  }

  return links
}

/**
 * The CSS of preview head HTML: the body of each `<style>` and the `href` of
 * each `<link rel="stylesheet">`. Comments and scripts are skipped.
 */
export function headStylesheets(html: string): { styles: string[]; links: string[] } {
  const styles: string[] = []
  const links: string[] = []
  let scanned = 0

  for (const match of html.matchAll(RAW_TEXT)) {
    const [text, styleStart, css] = match
    links.push(...stylesheetLinksIn(html.slice(scanned, match.index)))

    if (styleStart !== undefined) {
      styles.push(css)
    }

    scanned = match.index + text.length
  }

  links.push(...stylesheetLinksIn(html.slice(scanned)))

  return { styles, links }
}
