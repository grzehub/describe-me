import { within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { liveStop } from '@describe-me/core/live'
import { emptyLiveResult } from './empty-live-result.js'
import { isEmptyLiveUi } from './is-empty-live-ui.js'
import { mountLive, type LiveMountOptions } from './mount-live.js'

/**
 * Stands in for Testing Library's `render` on the live page. It mounts the
 * component and throws the stop signal, so the test ends at its first
 * render. For an empty UI it waits for the test's `rerender`.
 */
export function liveRenderTestingLibrary(ui: ReactNode, options: LiveMountOptions = {}): unknown {
  if (isEmptyLiveUi(ui)) {
    const result = emptyLiveResult(options, liveRenderTestingLibrary)

    return { ...within(result.baseElement as HTMLElement), ...result }
  }

  mountLive(ui, options)

  throw liveStop()
}
