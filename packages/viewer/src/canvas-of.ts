import { state } from './state.js'

/**
 * The canvas a frame stands on. A frame's `color-scheme` is `dark` on the dark
 * canvas and `light` on the other two.
 */
export type Canvas = 'light' | 'dark' | 'transparent'

/** The canvas the background switch picks, with `auto` standing for what `'auto'` resolves to. */
export function canvasOf(auto: 'light' | 'dark'): Canvas {
  return state.background === 'auto' ? auto : state.background
}
