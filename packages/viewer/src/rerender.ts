/**
 * Indirection so that state and data modules can trigger a repaint without
 * importing the panels that read them (which would be a cycle).
 */
let paint: () => void = () => {}

/** Install the repaint function. Called once from the bootstrap. */
export function setRerender(fn: () => void): void {
  paint = fn
}

/** Repaint the whole app. */
export function rerender(): void {
  paint()
}
