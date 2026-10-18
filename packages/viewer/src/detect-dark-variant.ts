import type { DarkVariantRoot } from '@describe-me/core/types'
import type { CustomProperty } from './read-custom-properties.js'

/**
 * How to show the dark variant that the token sheets declare: `'dark'` as the
 * class when dark values sit on `.dark`, the first `[data-<name>="dark"]` they
 * sit on as the attribute.
 */
export interface DarkVariant extends DarkVariantRoot {
  /** Whether dark values follow the color scheme, through `prefers-color-scheme: dark` or `light-dark()`. */
  media: boolean
}

const DARK_ATTRIBUTE = /\[(data-[\w-]+)="dark"\]/

/**
 * The dark variant of the custom properties, or `null` when they have none.
 * Free of the DOM and of the view, so the stage can apply the same result.
 */
export function detectDarkVariant(properties: readonly CustomProperty[]): DarkVariant | null {
  const variant: DarkVariant = { media: false }

  for (const { darkSource } of properties) {
    if (darkSource?.kind === 'media' || darkSource?.kind === 'light-dark') {
      variant.media = true
    } else if (darkSource?.kind === 'class') {
      variant.className = 'dark'
    } else if (darkSource?.kind === 'attribute' && !variant.attribute) {
      const match = DARK_ATTRIBUTE.exec(darkSource.selector)

      if (match?.[1]) {
        variant.attribute = { name: match[1], value: 'dark' }
      }
    }
  }

  if (!variant.media && !variant.className && !variant.attribute) {
    return null
  }

  return variant
}
