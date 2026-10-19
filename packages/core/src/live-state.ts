import type { DarkVariantRoot, LiveStatus } from './types.js'

/** What the height observer keeps between animation frames. */
interface LiveHeightState {
  observing: boolean
  queued: boolean
  reported: number | null
}

/** What the page put on its root for the viewer, so it can take back exactly that. */
export interface AppliedViewerRoot {
  root: DarkVariantRoot
  /** The class it added, or `null` when the root already had it. */
  addedClass: string | null
  /** The attribute it set, with the value it replaced, `null` when there was none. */
  attribute: { name: string; previous: string | null } | null
}

/** What the viewer asked of the page, and what the page applied of it. */
interface LiveViewerState {
  /** Whether a copy of core listens to the viewer already. */
  listening: boolean
  /** The last valid request, held until the page has a status. */
  requested: DarkVariantRoot | null
  applied: AppliedViewerRoot | null
}

/** Everything one live page shares, whichever copy of core reads it. */
export interface LiveState {
  status: LiveStatus | null
  stop: Error
  height: LiveHeightState
  viewer: LiveViewerState
}

const LIVE_KEY = Symbol.for('describe-me.live')

type GlobalWithLive = typeof globalThis & { [LIVE_KEY]?: LiveState }

function createStop(): Error {
  const stop = new Error('describe-me: the live preview stops the test at its first render')
  stop.name = 'LiveStop'

  return stop
}

/**
 * The state of the live page. Vite can serve two copies of core, one bundled
 * with an adapter and one from source, so the state lives on `globalThis`,
 * like the recorder.
 */
export function liveState(): LiveState {
  const scope = globalThis as GlobalWithLive

  scope[LIVE_KEY] ??= {
    status: null,
    stop: createStop(),
    height: { observing: false, queued: false, reported: null },
    viewer: { listening: false, requested: null, applied: null },
  }

  return scope[LIVE_KEY]
}
