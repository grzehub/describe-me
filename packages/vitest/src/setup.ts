/**
 * Vitest setup file: `setupFiles: ['@describe-me/vitest/setup']`.
 * Runs in the browser. Begins a recording before each test and hands the
 * frames to the reporter via task.meta.
 */
import { afterEach, beforeEach } from 'vitest'
import { META_KEY, recorder } from '@describe-me/core'

beforeEach(() => {
  recorder.begin()
})

afterEach(async (ctx) => {
  await recorder.capture('end', 'end of test')

  ;(ctx.task.meta as Record<string, unknown>)[META_KEY] = recorder.end()
})
