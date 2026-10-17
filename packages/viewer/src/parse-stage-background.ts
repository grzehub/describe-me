/** What the stage's canvas shows, and the color scheme of the frames on it. */
export type StageBackground = 'auto' | 'light' | 'dark' | 'transparent'

/** The background a link's `bg` names. Anything else, a missing value included, is `'auto'`. */
export function parseStageBackground(text: string | null): StageBackground {
  if (text === 'light' || text === 'dark' || text === 'transparent') {
    return text
  }

  return 'auto'
}
