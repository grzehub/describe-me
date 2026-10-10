/** The ids of the modules that live mode generates. The `\0` keeps other plugins off them. */
export const LIVE_MODULE_IDS = {
  entry: '\0describe-me-live:entry',
  vitest: '\0describe-me-live:vitest',
  vitestBrowser: '\0describe-me-live:vitest-browser',
  describeMeVitest: '\0describe-me-live:describe-me-vitest',
} as const
