import { renderInspector } from './inspector.js'
import { regions } from './regions.js'
import { rerender } from './rerender.js'
import { paintStage } from './stage.js'
import { state } from './state.js'
import { testView } from './test-view.js'
import { renderViewportControls } from './viewport-controls.js'

/**
 * Repaint what a frame or viewport change touches: the timeline selection, the
 * viewport toolbar, the inspector and the stage. Falls back to a full repaint
 * when the test view is not on screen.
 */
export function renderFrame(): void {
  const { main, timeline } = testView()
  if (state.suiteKey || !main.isConnected || main.hidden) {
    rerender('all')
    return
  }

  const buttons = Array.from(timeline.querySelectorAll<HTMLElement>('.frame'))
  buttons.forEach((button, i) => button.classList.toggle('active', i === state.frame))
  // Without `block`, an ancestor may scroll vertically to bring the button in.
  buttons[state.frame]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })

  renderViewportControls()
  regions().inspector.replaceChildren(...renderInspector())
  void paintStage()
}
