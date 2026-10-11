import type { LiveStatus } from '@describe-me/core/types'

/** One call of a `vi.fn()` prop, with its arguments as the live page labels them. */
export interface LiveAction {
  name: string
  args: string[]
}

/** What the live frame on the stage has reported since it loaded. */
export interface LiveSession {
  /** The test the live frame mounts. */
  testId: string | null
  /** `loading` until the page reports its status. */
  status: LiveStatus | 'loading'
  detail: string | null
  /** The last height of the page's content, `null` before the first. */
  height: number | null
  actions: LiveAction[]
  errors: string[]
  notices: string[]
  /** Bumped by Restart, so the stage builds a new frame for the same page. Never reset. */
  restarts: number
}

/** The session of the live frame on the stage. */
export const liveSession: LiveSession = {
  testId: null,
  status: 'loading',
  detail: null,
  height: null,
  actions: [],
  errors: [],
  notices: [],
  restarts: 0,
}
