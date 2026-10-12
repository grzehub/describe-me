import { state } from './state.js'

/** A search or a tag narrows the sidebar. Collapsed suites then open, so every match shows. */
export function filterActive(): boolean {
  return state.query.trim() !== '' || state.tag !== null
}
