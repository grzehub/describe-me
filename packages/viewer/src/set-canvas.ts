import type { Canvas } from './canvas-of.js'

/**
 * Put `canvas` on the stage or a thumbnail, painted with the page's color
 * when it has one. `transparent` keeps the checkerboard, and without a color
 * the bare canvases of `style.css` show.
 */
export function setCanvas(element: HTMLElement, canvas: Canvas, paint: string | null): void {
  element.dataset.canvas = canvas

  if (canvas === 'transparent' || paint === null) {
    element.style.removeProperty('background-color')
  } else {
    element.style.backgroundColor = paint
  }
}
