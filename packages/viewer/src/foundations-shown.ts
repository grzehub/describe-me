import { hasFoundations } from './has-foundations.js'
import { state } from './state.js'

/**
 * Whether Foundations takes the center: a section is open and the manifest has
 * tokens or names Material UI. Before a manifest is in, a link's section
 * waits, so nothing fetches `foundations.json` early. The repaint and
 * `testShown()` both ask this, and they must agree, or the test view's
 * repaint calls itself forever.
 */
export function foundationsShown(): boolean {
  return state.foundations !== null && hasFoundations(state.manifest?.foundations)
}
