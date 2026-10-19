import { state } from './state.js'
import { viewerTheme } from './viewer-theme.js'

/**
 * The canvas a frame stands on. A frame's `color-scheme` is `dark` on the dark
 * canvas and `light` on the other two, and the stage paints the canvas with
 * the page's own background when it has one.
 */
export type Canvas = 'light' | 'dark' | 'transparent'

/**
 * The canvas the background switch picks, with `auto` standing for what
 * `'auto'` resolves to for the frame. `null` there leaves it to the viewer
 * theme.
 */
export function canvasOf(auto: 'light' | 'dark' | null): Canvas {
  if (state.background !== 'auto') {
    return state.background
  }

  return auto ?? viewerTheme()
}
