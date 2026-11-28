import { state } from './state.js'

/**
 * A search, a tag or the Changed filter narrows the sidebar. Collapsed suites
 * then open, so every match shows.
 */
export function filterActive(): boolean {
  return state.query.trim() !== '' || state.tag !== null || state.changed
}
