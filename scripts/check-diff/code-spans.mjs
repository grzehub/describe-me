/** A span's text as CommonMark reads it: one padding space comes off each side. */
function spanText(raw) {
  const padded = raw.length >= 2 && raw.startsWith(' ') && raw.endsWith(' ') && raw.trim() !== ''

  return padded ? raw.slice(1, -1) : raw
}

/**
 * The code spans of a Markdown document and the text outside them, as
 * CommonMark reads them: a run of backticks opens a span that the next run
 * of the same length closes. A run without a closing one stays as text.
 */
export function codeSpans(markdown) {
  const spans = []
  let rest = markdown
  let outside = ''

  while (rest.length > 0) {
    const open = /`+/.exec(rest)

    if (open === null) {
      outside += rest
      break
    }

    const fence = open[0]
    const after = rest.slice(open.index + fence.length)
    const close = new RegExp(`(?<!\`)${fence}(?!\`)`).exec(after)

    if (close === null) {
      outside += rest.slice(0, open.index + fence.length)
      rest = after
      continue
    }

    outside += `${rest.slice(0, open.index)} `
    spans.push(spanText(after.slice(0, close.index)))
    rest = after.slice(close.index + fence.length)
  }

  return { spans, outside }
}
