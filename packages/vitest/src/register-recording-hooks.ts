import { afterEach, beforeEach } from 'vitest'
import { META_KEY, recorder } from '@describe-me/core'

/**
 * The per-test lifecycle shared by every environment: begin a recording
 * before each test, then take the closing frame, hand the frames to the
 * reporter via task.meta, and only then let adapters unmount.
 */
export function registerRecordingHooks(): void {
  beforeEach(() => {
    recorder.begin()
  })

  afterEach(async (context) => {
    await recorder.capture('end', 'end of test')

    ;(context.task.meta as Record<string, unknown>)[META_KEY] = recorder.end()

    recorder.teardown()
  })
}
