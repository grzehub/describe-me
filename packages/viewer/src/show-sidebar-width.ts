import { regions } from './regions.js'
import { SidebarWidth } from './sidebar-width.js'
import { state } from './state.js'

/**
 * Lay the sidebar out at the project's width, clamped to the window, and
 * return it. Cheap and idempotent, so every repaint and every drag frame can call it.
 */
export function showSidebarWidth(): number {
  const { columns, sidebarHandle } = regions()
  const chosen = state.manifest ? SidebarWidth.for(state.manifest.root).get() : SidebarWidth.DEFAULT
  const width = SidebarWidth.clamp(chosen)

  columns.style.setProperty('--sidebar-width', `${width}px`)
  sidebarHandle.setAttribute('aria-valuenow', String(width))
  sidebarHandle.setAttribute('aria-valuemax', String(SidebarWidth.max()))

  return width
}
