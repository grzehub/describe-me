const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i

const COLOR_KEYWORDS = new Set(['transparent', 'currentcolor'])

/**
 * Whether a theme value is a CSS color: hex, a color function, `transparent`
 * or `currentcolor`. Named colors stay out, because telling one from any other
 * word would take the whole list of names.
 */
export function isCssColor(value: string): boolean {
  const text = value.trim()

  return (
    HEX_COLOR.test(text) ||
    (COLOR_FUNCTION.test(text) && text.endsWith(')')) ||
    COLOR_KEYWORDS.has(text.toLowerCase())
  )
}
