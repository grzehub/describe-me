/** The text of an HTML fragment without its tags, entities left as they are. */
export function stripTags(html) {
  let text = ''
  let index = 0

  while (index < html.length) {
    const open = html.indexOf('<', index)
    if (open < 0) {
      return text + html.slice(index)
    }

    text += html.slice(index, open)

    const close = html.indexOf('>', open)
    index = close < 0 ? html.length : close + 1
  }

  return text
}
