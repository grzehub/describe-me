import { liveStop } from '@describe-me/core/live'

/**
 * Stands in for Testing Library's `renderHook` on the live page. A hook shows
 * nothing, so it stops the test and the page reports `no-render`.
 */
export function liveRenderHookTestingLibrary(): never {
  throw liveStop()
}
