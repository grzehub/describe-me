/** In the order a style's row lists them. */
const PARTS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textTransform',
]

/** A number is in px for these, as React and Emotion write it. A line height or weight has no unit. */
const PIXEL_PARTS = ['fontSize', 'letterSpacing']

/**
 * The parts of a type style object, such as a Material UI variant or
 * `typography.title` of a plain theme, as CSS text keyed by camelCase
 * property. Values that are not a string or a finite number are left out.
 */
export function typeStyleParts(style: Record<string, unknown>): Record<string, string> {
  const parts: Record<string, string> = {}

  for (const part of PARTS) {
    const value = style[part]

    if (typeof value === 'string') {
      parts[part] = value
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      parts[part] = PIXEL_PARTS.includes(part) ? `${value}px` : String(value)
    }
  }

  return parts
}
