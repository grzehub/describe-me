import type { LiveStatus } from './types.js'

/** What the height observer keeps between animation frames. */
interface LiveHeightState {
  observing: boolean
  queued: boolean
  reported: number | null
}

/** Everything one live page shares, whichever copy of core reads it. */
export interface LiveState {
  status: LiveStatus | null
  stop: Error
  height: LiveHeightState
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
  }

  return scope[LIVE_KEY]
}
