/**
 * Vitest setup file for DOM environments such as jsdom:
 * `setupFiles: ['@describe-me/vitest/setup-dom']`. Patches Testing Library's
 * userEvent, when it is installed, so every interaction records a frame, sets
 * React's act flag where Testing Library would, and registers the recording
 * hooks. The act flag is off while the recorder waits, as in Testing Library's
 * own waits. Which test files are recorded (`include` / `exclude`) and when the
 * render frame is taken (`renderFrame`) come from the plugin. Never imports
 * `vitest/browser`, which only exists in browser mode.
 */
import { actNeutralWait } from './act-neutral-wait.js'
import { mirrorReactActEnvironment } from './mirror-react-act-environment.js'
import { patchTestingLibraryUserEvent } from './patch-testing-library-user-event.js'
import { readRuntimeOptions } from './read-runtime-options.js'
import { registerRecordingHooks } from './register-recording-hooks.js'

await patchTestingLibraryUserEvent()
mirrorReactActEnvironment()
registerRecordingHooks(readRuntimeOptions(), actNeutralWait)
