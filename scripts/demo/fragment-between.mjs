import { linesBetween } from './lines-between.mjs'

/**
 * The lines of `text` from the first line that contains `from` to the next
 * line after it that is exactly `to`, or that first line alone without `to`,
 * as one text, so the stage shows a fragment of a file rather than the whole
 * of it.
 */
export function fragmentBetween(text, from, to) {
  const lines = text.split('\n')

  return linesBetween(text, from, to)
    .map((number) => lines[number - 1])
    .join('\n')
}
