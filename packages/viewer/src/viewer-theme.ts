/**
 * The viewer theme in effect: the one picked in the header, or the scheme of
 * the viewer's own window under `system`. `auto` falls back to it.
 */
export function viewerTheme(): 'light' | 'dark' {
  const theme = document.documentElement.dataset.theme

  if (theme === 'light' || theme === 'dark') {
    return theme
  }

  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
