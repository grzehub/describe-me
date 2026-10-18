const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g

/**
 * A block title from the segments of a name, so `['chakra', 'fontSizes']`
 * reads `Chakra font sizes`. Never holds a dash, a dot or the raw name.
 */
export function readableTitle(segments: readonly string[]): string {
  const words = segments
    .flatMap((segment) => segment.replace(CAMEL_BOUNDARY, '$1 $2').split(/[\s._-]+/))
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase())

  const [first = '', ...rest] = words

  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ')
}
