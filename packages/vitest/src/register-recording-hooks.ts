import { afterEach, beforeEach } from 'vitest'
import { META_KEY, recorder } from '@describe-me/core'
import { fileFilter } from './file-filter.js'
import type { RuntimeOptions } from './runtime-options.js'

/**
 * The per-test lifecycle shared by every environment: begin a recording
 * before each test of a file that `include` / `exclude` select, then take the
 * closing frame, hand the frames to the reporter via task.meta when there are
 * any, and only then let adapters unmount. Unmounting runs for every test,
 * recorded or not. Concurrent tests are never recorded: they would share the
 * one recorder.
 */
export function registerRecordingHooks(options: RuntimeOptions): void {
  const isRecordedFile = fileFilter(options)
  let warnedConcurrent = false

  beforeEach((context) => {
    if (context.task.concurrent) {
      if (!warnedConcurrent) {
        warnedConcurrent = true
        console.warn(`describe-me: concurrent tests are not recorded (${context.task.file.name})`)
      }

      return
    }

    if (isRecordedFile(context.task.file.name)) {
      recorder.begin()
    }
  })

  afterEach(async (context) => {
    try {
      if (recorder.isActive) {
        await recorder.capture('end', 'end of test')

        const record = recorder.end()

        if (record.frames.length > 0) {
          ;(context.task.meta as Record<string, unknown>)[META_KEY] = record
        }
      }
    } finally {
      recorder.teardown()
    }
  })
}
