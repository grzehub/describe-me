/** A part of a typography style, keyed as `FoundationToken.parts` keys it. */
export type TypographyPartName =
  'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight' | 'letterSpacing'

/** The part a token's name holds, and the name before it when the part ends the name. */
export interface TypographyPart {
  part: TypographyPartName
  /**
   * `--type-title` for `--type-title-font-size`. Null when the part does not
   * end the name or nothing precedes it.
   */
  stem: string | null
}

interface Word {
  text: string
  at: number
}

/** The two words of each part. The second may be plural, as in `--chakra-font-sizes-md`. */
const PARTS: [TypographyPartName, string, string[]][] = [
  ['fontFamily', 'font', ['family', 'families']],
  ['fontWeight', 'font', ['weight', 'weights']],
  ['fontSize', 'font', ['size', 'sizes']],
  ['lineHeight', 'line', ['height', 'heights']],
  ['letterSpacing', 'letter', ['spacing', 'spacings']],
]

/** Words of kebab, snake, dotted and camelCase names alike. */
const WORD = /[a-z0-9]+|[A-Z][a-z0-9]*/g
const TRAILING_SEPARATORS = /[-_.]+$/
const HAS_WORD = /[a-z0-9]/i

function wordsOf(name: string): Word[] {
  return Array.from(name.matchAll(WORD), (match) => ({
    text: match[0].toLowerCase(),
    at: match.index,
  }))
}

/** The part that starts at word `i`, as two words or joined into one, such as `lineheight`. */
function partAt(words: Word[], i: number): { part: TypographyPartName; length: number } | null {
  const word = words[i]?.text ?? ''
  const next = words[i + 1]?.text ?? ''

  for (const [part, first, seconds] of PARTS) {
    if (seconds.some((second) => word === first + second)) {
      return { part, length: 1 }
    }

    if (word === first && seconds.includes(next)) {
      return { part, length: 2 }
    }
  }

  return null
}

/**
 * The typography part a token's name holds, such as `fontSize` for
 * `--type-title-font-size`, `--font-size-lg`, `--heading-fontSize` or
 * `typography.fontSize.sm`. The last one wins when a name holds several.
 */
export function typographyPart(name: string): TypographyPart | null {
  const words = wordsOf(name)

  for (let i = words.length - 1; i >= 0; i--) {
    const found = partAt(words, i)

    if (found) {
      const last = words[i + found.length - 1]
      const ends = last !== undefined && last.at + last.text.length === name.length
      const stem = name.slice(0, words[i]?.at ?? 0).replace(TRAILING_SEPARATORS, '')

      return { part: found.part, stem: ends && HAS_WORD.test(stem) ? stem : null }
    }
  }

  return null
}
