import { showSidebarWidth } from './show-sidebar-width.js'
import { SidebarWidth } from './sidebar-width.js'
import { state } from './state.js'

interface Drag {
  width: SidebarWidth
  /** The width in memory before the drag, which a drag back to the start restores. */
  chosen: number
  startX: number
  startWidth: number
  shown: number
  pending: number | null
  frame: number | null
}

let drag: Drag | null = null

/** The width belongs to a project, so the handle does nothing before the manifest has loaded. */
function projectWidth(): SidebarWidth | null {
  return state.manifest ? SidebarWidth.for(state.manifest.root) : null
}

function applyPending(current: Drag): void {
  current.frame = null

  if (current.pending === null) {
    return
  }

  current.width.set(current.pending)
  current.shown = showSidebarWidth()
  current.pending = null
}

function onPointerDown(handle: HTMLElement, event: PointerEvent): void {
  const width = projectWidth()
  if (!width || event.button !== 0 || !event.isPrimary) {
    return
  }

  // Keeps focus where it was, so ← → still step frames after a drag.
  event.preventDefault()
  // Capture keeps the moves coming while the pointer is over an iframe or outside the window.
  handle.setPointerCapture(event.pointerId)

  const startWidth = SidebarWidth.clamp(width.get())
  drag = {
    width,
    chosen: width.get(),
    startX: event.clientX,
    startWidth,
    shown: startWidth,
    pending: null,
    frame: null,
  }

  document.documentElement.classList.add('sidebar-resizing')
}

/** At most one width per rendering frame, so the stage refits at most once per frame too. */
function onPointerMove(event: PointerEvent): void {
  const current = drag
  if (!current) {
    return
  }

  current.pending = SidebarWidth.clamp(current.startWidth + event.clientX - current.startX)

  if (current.frame === null) {
    current.frame = requestAnimationFrame(() => applyPending(current))
  }
}

/** Follows `pointerup` and `pointercancel`. The last move is applied, never dropped. */
function onDragEnd(): void {
  const current = drag
  if (!current) {
    return
  }

  drag = null

  if (current.frame !== null) {
    cancelAnimationFrame(current.frame)
  }

  applyPending(current)

  if (current.shown === current.startWidth) {
    current.width.set(current.chosen)
  } else {
    current.width.save()
  }

  document.documentElement.classList.remove('sidebar-resizing')
}

function onKeyDown(event: KeyboardEvent): void {
  const width = projectWidth()
  // Alt+← is Back in Chrome on Windows and Linux.
  if (!width || event.ctrlKey || event.metaKey || event.altKey) {
    return
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  const step = event.key === 'ArrowRight' ? SidebarWidth.STEP : -SidebarWidth.STEP

  width.set(SidebarWidth.clamp(SidebarWidth.clamp(width.get()) + step))
  width.save()
  showSidebarWidth()
  event.preventDefault()
}

function onDoubleClick(): void {
  const width = projectWidth()
  if (!width) {
    return
  }

  width.reset()
  showSidebarWidth()
}

/** Drag, ← → and a double-click on the sidebar's edge set its width. Called once. */
export function wireSidebarHandle(handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (event) => onPointerDown(handle, event))
  handle.addEventListener('pointermove', onPointerMove)
  handle.addEventListener('lostpointercapture', onDragEnd)
  handle.addEventListener('keydown', onKeyDown)
  handle.addEventListener('dblclick', onDoubleClick)
  window.addEventListener('resize', () => showSidebarWidth())

  showSidebarWidth()
}
