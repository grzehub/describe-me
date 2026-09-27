/**
 * Vitest setup file for DOM environments such as jsdom:
 * `setupFiles: ['@describe-me/vitest/setup-dom']`. Patches Testing Library's
 * userEvent, when it is installed, so every interaction records a frame, sets
 * React's act flag where Testing Library would, and registers the recording
 * hooks. Which test files are recorded (`include` / `exclude`) comes from the
 * plugin. Never imports `vitest/browser`, which only exists in browser mode.
 */
import { mirrorReactActEnvironment } from './mirror-react-act-environment.js'
import { patchTestingLibraryUserEvent } from './patch-testing-library-user-event.js'
import { readRuntimeOptions } from './read-runtime-options.js'
import { registerRecordingHooks } from './register-recording-hooks.js'

await patchTestingLibraryUserEvent()
mirrorReactActEnvironment()
registerRecordingHooks(readRuntimeOptions())
