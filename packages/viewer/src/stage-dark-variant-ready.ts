import { loadFoundations } from './load-foundations.js'
import { state } from './state.js'
import { viewerTheme } from './viewer-theme.js'

/**
 * Whether a frame may stand on the dark canvas before it is read: under
 * `dark`, or under `auto` with the dark viewer theme.
 */
function mayBeDark(): boolean {
  return state.background === 'dark' || (state.background === 'auto' && viewerTheme() === 'dark')
}

/**
 * Resolves once `stageDarkVariant()` can answer for the manifest on screen, so
 * a frame never shows its light variant before its dark one. At once unless
 * the stage may be dark and the manifest has tokens.
 */
export async function stageDarkVariantReady(): Promise<void> {
  if (!mayBeDark() || (state.manifest?.foundations?.tokens ?? 0) <= 0) {
    return
  }

  const load = loadFoundations()

  if (load.status === 'loading') {
    await load.settled
  }
}
