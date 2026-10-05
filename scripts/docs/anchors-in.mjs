import { startTags } from './start-tags.mjs'

/** Every `<a>` of an HTML fragment in source order: its attributes as written and its inner HTML. */
export function anchorsIn(html) {
  return startTags(html)
    .filter((tag) => tag.name === 'a')
    .map((tag) => {
      const close = html.indexOf('</a', tag.end)

      return {
        attributes: tag.attributes,
        inner: html.slice(tag.end, close < 0 ? html.length : close),
      }
    })
}
