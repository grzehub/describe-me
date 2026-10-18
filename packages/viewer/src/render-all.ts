import { renderFoundationsInspector } from './foundations-inspector.js'
import { foundationsShown } from './foundations-shown.js'
import { showFoundations } from './foundations-view.js'
import { renderHeader } from './header.js'
import { renderMain } from './main-panel.js'
import { renderOverview } from './overview.js'
import { renderOverviewInspector } from './overview-inspector.js'
import { regions } from './regions.js'
import { renderFrame } from './render-frame.js'
import { renderTree } from './render-tree.js'
import { showSidebarWidth } from './show-sidebar-width.js'
import { state } from './state.js'
import { testView } from './test-view.js'
import { versionBanner } from './version-banner.js'

/** Foundations leaves the DOM when it closes, so its iframe never lingers. */
function removeFoundations(center: HTMLElement): void {
  center.querySelector(':scope > .foundations')?.remove()
}

/** The overview takes the center, over the test view, which stays mounted but hidden. */
function showOverview(center: HTMLElement, inspector: HTMLElement, key: string): void {
  const { main } = testView()
  if (main.isConnected) {
    main.hidden = true
  }

  removeFoundations(center)

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

/** Foundations takes the center like the overview, over the hidden test view. */
function showFoundationsView(center: HTMLElement, inspector: HTMLElement): void {
  const { main } = testView()
  if (main.isConnected) {
    main.hidden = true
  }

  center.querySelector(':scope > .overview')?.remove()
  showFoundations(center)
  inspector.replaceChildren(...renderFoundationsInspector())
}

function showTest(center: HTMLElement): void {
  const { main } = testView()
  if (main.parentElement !== center) {
    // The first mount, which also clears the startup error message.
    center.replaceChildren(main)
  } else {
    center.querySelector(':scope > .overview')?.remove()
    removeFoundations(center)
    main.hidden = false
  }

  renderMain()
  renderFrame()
}

/**
 * Repaint every region from `state`: Foundations when a section is open and
 * the manifest has tokens, the overview when a suite is selected, else one
 * test. The branches follow `testShown()`, which `renderFrame()` checks.
 */
export function renderAll(): void {
  const { headerInfo, banner, center, inspector } = regions()
  headerInfo.replaceChildren(...renderHeader())

  const text = versionBanner(state.manifest)
  banner.textContent = text ?? ''
  banner.hidden = text === null

  showSidebarWidth()
  renderTree()

  if (foundationsShown()) {
    showFoundationsView(center, inspector)
  } else if (state.suiteKey) {
    showOverview(center, inspector, state.suiteKey)
  } else {
    showTest(center)
  }
}
