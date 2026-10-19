import { loadFoundations } from './load-foundations.js'
import { state } from './state.js'

/**
 * Resolves once `stageDarkVariant()` can answer for the manifest on screen, so
 * a frame never shows its light variant before its dark one. At once unless
 * the stage is dark and the manifest has tokens.
 */
export async function stageDarkVariantReady(): Promise<void> {
  if (state.background !== 'dark' || (state.manifest?.foundations?.tokens ?? 0) <= 0) {
    return
  }

  const load = loadFoundations()

  if (load.status === 'loading') {
    await load.settled
  }
}
