import { foundationsShown } from './foundations-shown.js'
import { rerender } from './rerender.js'
import { state } from './state.js'
import { viewerTheme } from './viewer-theme.js'

let last: 'light' | 'dark' | null = null

/** Foundations ignores the theme, and leaving it repaints the stage, which reads the theme again. */
function onThemeChange(): void {
  const theme = viewerTheme()

  if (theme === last) {
    return
  }

  last = theme

  if (state.background === 'auto' && !foundationsShown()) {
    rerender('frame')
  }
}

/**
 * Repaint the stage, the thumbnails and Live when the viewer theme changes
 * under `auto`, which falls back to it: a pick in the header, or the system's
 * scheme under `system`. Installed once, at startup.
 */
export function watchViewerTheme(): void {
  last = viewerTheme()

  new MutationObserver(onThemeChange).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onThemeChange)
}
