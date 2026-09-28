const GOOGLE_FONTS_HOST = 'fonts.googleapis.com'
const GOOGLE_FONTS_PATHS = new Set(['/css', '/css2', '/icon'])

const BUNNY_FONTS_HOST = 'fonts.bunny.net'
const BUNNY_FONTS_PATHS = new Set(['/css', '/css2'])

const JSDELIVR_HOST = 'cdn.jsdelivr.net'

/** Fontsource names the family of `@fontsource-variable/inter` `Inter Variable`. */
const FONTSOURCE_SCOPES = new Map([
  ['@fontsource', ''],
  ['@fontsource-variable', ' Variable'],
])

function parsedUrl(url: string): URL | null {
  const decoded = url.replaceAll('&amp;', '&')
  const absolute = decoded.startsWith('//') ? `https:${decoded}` : decoded

  return URL.canParse(absolute) ? new URL(absolute) : null
}

/** `family=Open+Sans:400,700|Roboto+Mono`, repeated or not, as `Open Sans` and `Roboto Mono`. */
function familyParameters(url: URL): string[] {
  return url.searchParams
    .getAll('family')
    .flatMap((value) => value.split('|'))
    .map((family) => family.split(':')[0].trim())
    .filter((family) => family !== '')
}

/** `/npm/@fontsource/<package>[@version]/…` as the family the package loads. */
function fontsourceFamilies(url: URL): string[] | null {
  const [, registry, scope, name] = url.pathname.split('/')
  const suffix = FONTSOURCE_SCOPES.get(scope)
  const packageName = name?.split('@')[0]

  if (registry !== 'npm' || suffix === undefined || !packageName) {
    return null
  }

  return [`${packageName}${suffix}`]
}

/**
 * The families a remote stylesheet loads, read from its URL. Null when the
 * provider is unknown: Google Fonts, Bunny Fonts and Fontsource on jsDelivr
 * are the ones whose URLs name their families.
 */
export function fontStylesheetFamilies(url: string): string[] | null {
  const parsed = parsedUrl(url)
  if (parsed === null) {
    return null
  }

  if (parsed.hostname === GOOGLE_FONTS_HOST && GOOGLE_FONTS_PATHS.has(parsed.pathname)) {
    return familyParameters(parsed)
  }

  if (parsed.hostname === BUNNY_FONTS_HOST && BUNNY_FONTS_PATHS.has(parsed.pathname)) {
    return familyParameters(parsed)
  }

  if (parsed.hostname === JSDELIVR_HOST) {
    return fontsourceFamilies(parsed)
  }

  return null
}
