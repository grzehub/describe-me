// JSON.stringify leaves these as they are. Escaped, a file name cannot close a
// script tag that inlines the entry, nor end a line for an older parser.
const UNSAFE_IN_CODE = /[<>\u2028\u2029]/g

/** A string literal for the modules that live mode generates. */
export function liveStringLiteral(value: string): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_CODE,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
