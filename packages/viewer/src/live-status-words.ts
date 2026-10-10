import type { LiveStatus } from '@describe-me/core/types'

/**
 * How the inspector says each live status. Keyed by every member of
 * `LiveStatus`, so a new status fails the typecheck until it has words.
 */
export const liveStatusWords: Record<LiveStatus | 'loading', string> = {
  loading: 'mounting…',
  mounted: 'mounted as the test arranged it',
  'no-render': 'the test renders no component',
  'not-found': 'the test is not in its file',
  'import-failed': 'the test file does not load in the browser',
  failed: 'the arrange phase failed',
}
