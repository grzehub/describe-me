import type { ReactNode } from 'react'
import { liveInert, liveStop } from '@describe-me/core/live'
import { emptyLiveResult, type EmptyLiveResult } from './empty-live-result.js'
import { isEmptyLiveUi } from './is-empty-live-ui.js'
import { mountLive, type LiveMountOptions } from './mount-live.js'

/** The rest of a vitest-browser-react screen, such as its locators, is inert. Its `then` too. */
function withInertRest(result: EmptyLiveResult): EmptyLiveResult {
  return new Proxy(result, {
    get(target, key, receiver) {
      if (key in target) {
        return Reflect.get(target, key, receiver)
      }

      return Reflect.get(liveInert() as object, key)
    },
  })
}

/**
 * Stands in for `render` from vitest-browser-react on the live page. It
 * mounts the component and rejects with the stop signal, so the test ends at
 * its first render. For an empty UI it waits for the test's `rerender`.
 */
export function liveRender(ui: ReactNode, options: LiveMountOptions = {}): Promise<unknown> {
  if (isEmptyLiveUi(ui)) {
    return Promise.resolve(withInertRest(emptyLiveResult(options, liveRender)))
  }

  mountLive(ui, options)

  return Promise.reject(liveStop())
}
