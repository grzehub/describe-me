/** What a URL on a font host points at. */
export type FontKind = 'stylesheet' | 'font'

/** A font host that serves a URL: vendorable with its kind, or remote for a reason. */
export type FontProvider =
  | { name: string; vendorable: true; kind: FontKind }
  | { name: string; vendorable: false; reason: string }

interface Host {
  name: string
  kind: (pathname: string) => FontKind | null
}

const FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf']

const FONTSOURCE_PACKAGES = ['/npm/@fontsource/', '/npm/@fontsource-variable/']

const FONTSOURCE_FILES = '/fontsource/fonts/'

const GOOGLE_STYLESHEETS = new Set(['/css', '/css2', '/icon'])

const BUNNY_STYLESHEETS = new Set(['/css', '/css2'])

const ADOBE_HOSTS = new Set([
  'use.typekit.net',
  'use.typekit.com',
  'p.typekit.net',
  'fonts.adobe.com',
])

const ADOBE: FontProvider = {
  name: 'Adobe Fonts',
  vendorable: false,
  reason: 'Adobe Fonts do not allow self-hosting',
}

function hasFontExtension(pathname: string): boolean {
  const lower = pathname.toLowerCase()

  return FONT_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

function googleApis(pathname: string): FontKind | null {
  return GOOGLE_STYLESHEETS.has(pathname) ? 'stylesheet' : null
}

function googleStatic(pathname: string): FontKind | null {
  return pathname === '/' ? null : 'font'
}

function bunny(pathname: string): FontKind | null {
  if (BUNNY_STYLESHEETS.has(pathname)) {
    return 'stylesheet'
  }

  return pathname.includes('/files/') ? 'font' : null
}

function fontsource(pathname: string): FontKind | null {
  if (FONTSOURCE_PACKAGES.some((prefix) => pathname.startsWith(prefix))) {
    if (pathname.toLowerCase().endsWith('.css')) {
      return 'stylesheet'
    }

    return hasFontExtension(pathname) ? 'font' : null
  }

  return pathname.startsWith(FONTSOURCE_FILES) ? 'font' : null
}

/** The allowlist, by exact hostname. */
const HOSTS = new Map<string, Host>([
  ['fonts.googleapis.com', { name: 'Google Fonts', kind: googleApis }],
  ['fonts.gstatic.com', { name: 'Google Fonts', kind: googleStatic }],
  ['fonts.bunny.net', { name: 'Bunny Fonts', kind: bunny }],
  ['cdn.jsdelivr.net', { name: 'Fontsource on jsDelivr', kind: fontsource }],
])

/**
 * The font host behind a URL, or null when the URL is not a stylesheet or a
 * font of a known host. Bare origins, such as a `preconnect`, are null too.
 */
export function fontProvider(url: URL): FontProvider | null {
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.port !== '') {
    return null
  }

  if (ADOBE_HOSTS.has(url.hostname)) {
    return url.pathname === '/' ? null : ADOBE
  }

  const host = HOSTS.get(url.hostname)
  const kind = host?.kind(url.pathname) ?? null

  if (host === undefined || kind === null) {
    return null
  }

  return { name: host.name, vendorable: true, kind }
}
