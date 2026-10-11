import { testView } from './test-view.js'

/** The iframe of the live slot on the stage, or `null` when the stage has none. */
export function liveIframe(): HTMLIFrameElement | null {
  return testView().frames.querySelector<HTMLIFrameElement>(':scope > .live-slot > iframe')
}
