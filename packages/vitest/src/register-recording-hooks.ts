import { afterEach, beforeEach } from 'vitest'
import { META_KEY, recorder } from '@describe-me/core'
import type { AroundWait } from '@describe-me/core'
import { fileFilter } from './file-filter.js'
import type { RuntimeOptions } from './runtime-options.js'
import { tagFilter } from './tag-filter.js'

/**
 * The per-test lifecycle shared by every environment: begin a recording, take
 * a deferred render frame or else the closing frame, hand the frames to the
 * reporter via task.meta, and only then let adapters unmount. Which tests
 * record follows the file globs and then the test's tags. Teardown runs
 * for unrecorded tests too, because Testing Library's auto-cleanup is off in
 * jsdom. Concurrent tests would share the one recorder, so they are not
 * recorded. The hooks destructure the context, because Vitest rejects any
 * other first parameter in a test that has `test.extend` fixtures.
 */
export function registerRecordingHooks(options: RuntimeOptions, aroundWait?: AroundWait): void {
  const isRecordedFile = fileFilter(options)
  const isRecordedTags = tagFilter(options.stories)
  let warnedConcurrent = false

  recorder.configure({ renderFrame: options.renderFrame, aroundWait })

  beforeEach(({ task }) => {
    if (task.concurrent) {
      if (!warnedConcurrent) {
        warnedConcurrent = true
        console.warn(`describe-me: concurrent tests are not recorded (${task.file.name})`)
      }

      return
    }

    // Vitest before 4.1 has no tags, so every test counts as untagged.
    if (isRecordedFile(task.file.name) && isRecordedTags(task.tags ?? [])) {
      recorder.begin()
    }
  })

  afterEach(async ({ task }) => {
    try {
      if (recorder.isActive) {
        const tookRender = await recorder.flush()

        // A render frame taken this late already shows how the test ended.
        if (!tookRender) {
          await recorder.capture('end', 'end of test')
        }

        const record = recorder.end()

        if (record.frames.length > 0) {
          ;(task.meta as Record<string, unknown>)[META_KEY] = record
        }
      }
    } finally {
      recorder.teardown()
    }
  })
}
