import { liveSession } from './live-session.js'

/** Start a fresh session for a new live frame of `testId`. The Restart count stays. */
export function resetLiveSession(testId: string): void {
  liveSession.testId = testId
  liveSession.status = 'loading'
  liveSession.detail = null
  liveSession.height = null
  liveSession.actions = []
  liveSession.errors = []
  liveSession.notices = []
}
