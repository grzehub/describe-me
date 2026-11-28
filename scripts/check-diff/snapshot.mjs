import { createHash } from 'node:crypto'

/** The first 16 hex characters of a SHA-1, as the reporter names stored files. */
export function contentName(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 16)
}

function styleNode(css, cssIn) {
  if (cssIn === 'text') {
    return {
      type: 2,
      tagName: 'style',
      attributes: {},
      childNodes: [{ type: 3, textContent: css, id: 6 }],
      id: 5,
    }
  }

  const cssText = cssIn === 'reference' ? `describe-me-style:${contentName(css)}` : css

  return {
    type: 2,
    tagName: 'style',
    attributes: { _cssText: cssText },
    childNodes: [{ type: 3, textContent: '', id: 6 }],
    id: 5,
  }
}

/**
 * A small rrweb-shaped document: one stylesheet in the head and one element
 * in the body. `cssIn` says where the stylesheet text goes: an inline
 * `_cssText` (`inline`), a `describe-me-style:` reference (`reference`) or the
 * text of the `<style>` (`text`). `states` and `image` add the states
 * attribute and an `<img>` with a `describe-me-asset:` URL.
 */
export function snapshot({
  text = 'Hello',
  className = 'box',
  css = 'body { margin: 0 }',
  cssIn = 'inline',
  states,
  image,
} = {}) {
  const attributes = { class: className }

  if (states !== undefined) {
    attributes['data-describe-me-states'] = states
  }

  const children = [{ type: 3, textContent: text, id: 9 }]

  if (image !== undefined) {
    children.push({
      type: 2,
      tagName: 'img',
      attributes: { src: `describe-me-asset:${image}` },
      childNodes: [],
      id: 10,
    })
  }

  return {
    type: 0,
    childNodes: [
      { type: 1, name: 'html', publicId: '', systemId: '', id: 2 },
      {
        type: 2,
        tagName: 'html',
        attributes: { lang: 'en' },
        childNodes: [
          { type: 2, tagName: 'head', attributes: {}, childNodes: [styleNode(css, cssIn)], id: 4 },
          {
            type: 2,
            tagName: 'body',
            attributes: {},
            childNodes: [{ type: 2, tagName: 'div', attributes, childNodes: children, id: 8 }],
            id: 7,
          },
        ],
        id: 3,
      },
    ],
    id: 1,
  }
}
