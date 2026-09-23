/**
 * Vitest setup file for browser mode: `setupFiles: ['@describe-me/vitest/setup']`.
 * Patches Vitest's locators and userEvent so every interaction records a
 * frame, and registers the recording hooks. For jsdom use `./setup-dom`.
 */
import { patchLocators } from './patch-locators.js'
import { patchUserEvent } from './patch-user-event.js'
import { registerRecordingHooks } from './register-recording-hooks.js'

patchLocators()
patchUserEvent()
registerRecordingHooks()
