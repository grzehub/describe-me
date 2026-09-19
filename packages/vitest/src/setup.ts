/**
 * Vitest setup file: `setupFiles: ['@describe-me/vitest/setup']`.
 * Runs in the browser. Patches Vitest's locators and userEvent so every
 * interaction records a frame, begins a recording before each test, and hands
 * the frames to the reporter via task.meta.
 */
import { afterEach, beforeEach } from 'vitest'
import { META_KEY, recorder } from '@describe-me/core'
import { patchLocators } from './patch-locators.js'
import { patchUserEvent } from './patch-user-event.js'

patchLocators()
patchUserEvent()

beforeEach(() => {
  recorder.begin()
})

afterEach(async (context) => {
  await recorder.capture('end', 'end of test')

  ;(context.task.meta as Record<string, unknown>)[META_KEY] = recorder.end()
})
