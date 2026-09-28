import { pageHasContent } from './page-has-content.js'
import { realTimers } from './real-timers.js'

/**
 * How long to watch for the loader to go, in ms of real time. After that the
 * frame waits as in `'lazy'`.
 */
const DEFAULT_TIMEOUT = 2000

const WATCHED: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
}

/**
 * Watches the page while a render frame waits for its loader to go, and calls
 * `onReady` once nothing matches `selector` and the page shows content. After
 * `timeout` ms it stops watching and leaves the frame deferred, so the next
 * interaction or the end of the test takes it.
 */
export class PendingRender {
  private observer: MutationObserver | null
  private timer: ReturnType<typeof realTimers.setTimeout> | null

  constructor(selector: string, timeout: number | undefined, onReady: () => void) {
    this.observer = new MutationObserver(() => {
      if (!PendingRender.isReady(selector)) {
        return
      }

      this.dispose()
      onReady()
    })

    this.observer.observe(document, WATCHED)
    this.timer = realTimers.setTimeout(() => this.dispose(), timeout ?? DEFAULT_TIMEOUT)
  }

  /**
   * Whether the frame can be taken: nothing matches `selector` and the page
   * shows content. The selector goes first, because it is cheap while the
   * loader is shown.
   */
  static isReady(selector: string): boolean {
    return document.querySelector(selector) === null && pageHasContent()
  }

  /** Stop watching. Safe to call twice. */
  dispose(): void {
    this.observer?.disconnect()
    this.observer = null

    if (this.timer !== null) {
      realTimers.clearTimeout(this.timer)
      this.timer = null
    }
  }
}
