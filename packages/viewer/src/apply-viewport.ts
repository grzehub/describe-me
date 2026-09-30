import { naturalHeight } from './natural-height.js'
import { state } from './state.js'

/**
 * Size a stage slot and its iframe to the viewport in `state`, scaled down when
 * it is wider than the stage. Returns the scale.
 */
export function applyViewport(
  slot: HTMLElement,
  iframe: HTMLIFrameElement,
  stage: HTMLElement,
): number {
  const padding = getComputedStyle(stage)
  const available =
    stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)

  // A hidden test view has no width. The same-frame paint fits it again once it shows.
  if (available <= 0) {
    return 1
  }

  const width = state.viewport.width ?? available
  const scale = Math.min(1, available / width)
  const visibleHeight =
    stage.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom)

  iframe.style.width = `${width}px`

  const height =
    state.viewport.height ?? naturalHeight(iframe, visibleHeight / scale) ?? iframe.offsetHeight

  iframe.style.height = `${height}px`

  if (scale < 1) {
    iframe.style.transform = `scale(${scale})`
    iframe.style.transformOrigin = '0 0'
  } else {
    iframe.style.transform = ''
    iframe.style.transformOrigin = ''
  }

  // The slot clips to the scaled box, so the unscaled iframe never widens the stage's scroll area.
  slot.style.width = `${width * scale}px`
  slot.style.height = `${height * scale}px`

  return scale
}
