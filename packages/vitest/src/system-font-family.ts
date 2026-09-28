import { fontFamilyKey } from './font-family-key.js'

const CSS_WIDE_KEYWORDS = ['inherit', 'initial', 'unset', 'revert', 'revert-layer']

const GENERIC_FAMILIES = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]

// Roboto, Ubuntu, Oxygen, Fira, Cantarell, Noto Sans, Open Sans and Inter are
// left out on purpose. They come preinstalled on some systems, but they are
// Google Fonts too, and a page that uses them usually has to load them.
const INSTALLED_FAMILIES = [
  '-apple-system',
  'BlinkMacSystemFont',
  'SFMono-Regular',
  'San Francisco',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Menlo',
  'Monaco',
  'Consolas',
  'Impact',
  'Comic Sans MS',
  'Book Antiqua',
  'Cambria',
  'Calibri',
  'Candara',
  'Gill Sans',
  'Optima',
  'Geneva',
  'Symbol',
  'Webdings',
  'Wingdings',
  'Apple Color Emoji',
  'Noto Color Emoji',
  'Android Emoji',
]

/** Each covers its whole family, so `Times New Roman` counts and `Timeless` does not. */
const INSTALLED_PREFIXES = [
  'Segoe UI',
  'Helvetica',
  'Arial',
  'Times',
  'Courier',
  'Lucida',
  'Palatino',
  'SF Pro',
  'SF Mono',
  'Avenir',
  'DejaVu',
  'Liberation',
  'PingFang',
  'Hiragino',
  'Microsoft YaHei',
  'Yu Gothic',
  'Meiryo',
].map(fontFamilyKey)

const EXACT = new Set(
  [...CSS_WIDE_KEYWORDS, ...GENERIC_FAMILIES, ...INSTALLED_FAMILIES].map(fontFamilyKey),
)

/**
 * Whether a family needs no loading: a CSS-wide keyword, a generic family, or
 * a family that ships with common operating systems.
 */
export function isSystemFontFamily(name: string): boolean {
  const key = fontFamilyKey(name)

  return (
    EXACT.has(key) ||
    INSTALLED_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix} `))
  )
}
