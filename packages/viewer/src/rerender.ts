/**
 * Indirection so that state and data modules can trigger a repaint without
 * importing the panels that read them (which would be a cycle).
 */
let paint: (scope: 'all' | 'frame') => void = () => {}

/** Install the repaint function. Called once from the bootstrap. */
export function setRerender(fn: (scope: 'all' | 'frame') => void): void {
  paint = fn
}

/** Repaint the whole app, or with `'frame'` only what a frame or viewport change touches. */
export function rerender(scope: 'all' | 'frame' = 'all'): void {
  paint(scope)
}
