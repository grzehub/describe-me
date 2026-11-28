import type { TextFormat } from './text-format.js'

const PLAIN_NAME = /^[A-Za-z][A-Za-z0-9]*$/
// A leading digit keeps a host name such as www.example.com from passing as a version.
const PLAIN_VERSION = /^[0-9][0-9A-Za-z.+-]*$/

function shortened(text: string, max: number): string {
  const characters = Array.from(text.replace(/\r\n?|\n/g, ' '))

  return characters.length > max ? `${characters.slice(0, max - 1).join('')}…` : characters.join('')
}

/**
 * A code span renders no HTML or Markdown and triggers no mention or issue
 * link. Its fence is longer than any backtick run inside, and a space pads
 * text that starts or ends with a backtick or a space, which the span drops.
 */
function codeSpan(text: string, max: number): string {
  const inner = shortened(text, max)
  const longestRun = Math.max(0, ...(inner.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(longestRun + 1)
  const padded = inner === '' || /^[` ]|[` ]$/.test(inner) ? ` ${inner} ` : inner

  return `${fence}${padded}${fence}`
}

/**
 * Markdown for a pull request comment. Text from a manifest goes in code
 * spans of at most `max` characters, so no name can break the layout or the
 * length limit.
 */
export function markdownFormat(max: number): TextFormat {
  return {
    code: (text) => codeSpan(text, max),
    word: (text) =>
      PLAIN_NAME.test(text) || PLAIN_VERSION.test(text) ? text : codeSpan(text, max),
  }
}
