import { attributeValues } from './attribute-values.mjs'

/** The `id` of every element of a page, in source order and with repeats. */
export function idsIn(html) {
  return attributeValues(html, 'id')
}
