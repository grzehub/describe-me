import { liveStop } from '@describe-me/core/live'

/**
 * Stands in for `renderHook` from vitest-browser-react on the live page. A
 * hook shows nothing, so it stops the test and the page reports `no-render`.
 */
export function liveRenderHook(): Promise<never> {
  return Promise.reject(liveStop())
}
