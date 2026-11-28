import { renderInspector } from './inspector.js'
import { liveShown } from './live-shown.js'
import { regions } from './regions.js'
import { rerender } from './rerender.js'
import { paintStage } from './stage.js'
import { state } from './state.js'
import { testShown } from './test-shown.js'
import { testView } from './test-view.js'
import { renderViewportControls } from './viewport-controls.js'

/** The timeline's button of the removed frame on screen, else the one of `state.frame`. */
function activeButton(timeline: HTMLElement): HTMLElement | null {
  const removed =
    state.removedFrame === null
      ? null
      : timeline.querySelector<HTMLElement>(`.frame[data-removed="${state.removedFrame}"]`)

  return removed ?? timeline.querySelector<HTMLElement>(`.frame[data-frame="${state.frame}"]`)
}

/**
 * Repaint what a frame, viewport or Live change touches: the timeline
 * selection, the viewport toolbar, the stage and the inspector. Falls back to
 * a full repaint when the test view is not on screen.
 */
export function renderFrame(): void {
  const { main, timeline } = testView()
  if (!testShown() || !main.isConnected || main.hidden) {
    rerender('all')
    return
  }

  const active = liveShown() ? null : activeButton(timeline)

  for (const button of timeline.querySelectorAll<HTMLElement>('.frame')) {
    button.classList.toggle('active', button === active)
  }

  // Without `block`, an ancestor may scroll vertically to bring the button in.
  active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })

  renderViewportControls()
  // The stage first: a new live frame starts a new session, which the inspector shows.
  void paintStage()
  regions().inspector.replaceChildren(...renderInspector())
}
