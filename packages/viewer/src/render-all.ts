import { renderHeader } from './header.js'
import { renderMain } from './main-panel.js'
import { renderOverview } from './overview.js'
import { renderOverviewInspector } from './overview-inspector.js'
import { regions } from './regions.js'
import { renderFrame } from './render-frame.js'
import { renderTree } from './render-tree.js'
import { state } from './state.js'
import { testView } from './test-view.js'

/** The overview takes the center, over the test view, which stays mounted but hidden. */
function showOverview(center: HTMLElement, inspector: HTMLElement, key: string): void {
  const { main } = testView()
  if (main.isConnected) {
    main.hidden = true
  }

  const overview = renderOverview()
  overview.dataset.suite = key

  const previous = center.querySelector<HTMLElement>(':scope > .overview')
  if (previous) {
    const scrollTop = previous.scrollTop
    previous.replaceWith(overview)
    // Tiles have a fixed height, so the layout is already final here.
    if (previous.dataset.suite === key) {
      overview.scrollTop = scrollTop
    }
  } else if (main.isConnected) {
    center.append(overview)
  } else {
    // The first paint, which also clears the startup error message.
    center.replaceChildren(overview)
  }

  inspector.replaceChildren(...renderOverviewInspector())
}

function showTest(center: HTMLElement): void {
  const { main } = testView()
  if (main.parentElement !== center) {
    // The first mount, which also clears the startup error message.
    center.replaceChildren(main)
  } else {
    center.querySelector(':scope > .overview')?.remove()
    main.hidden = false
  }

  renderMain()
  renderFrame()
}

/** Repaint every region from `state`: the overview when a suite is selected, else one test. */
export function renderAll(): void {
  const { header, center, inspector } = regions()
  header.replaceChildren(...renderHeader())
  renderTree()

  if (state.suiteKey) {
    showOverview(center, inspector, state.suiteKey)
  } else {
    showTest(center)
  }
}
