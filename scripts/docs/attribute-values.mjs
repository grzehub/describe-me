import { startTags } from './start-tags.mjs'

/** The values of one attribute across every element of a page, as written in the source. */
export function attributeValues(html, name) {
  return startTags(html)
    .map((tag) => tag.attributes[name])
    .filter((value) => value !== undefined)
}
