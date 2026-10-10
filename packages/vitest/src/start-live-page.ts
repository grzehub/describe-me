import { reportLiveStatus } from '@describe-me/core/live'
import { collectLiveSuites } from './collect-live-suites.js'
import { findLiveTest } from './find-live-test.js'
import { installLiveGlobals } from './install-live-globals.js'
import { liveErrorDetail } from './live-error-detail.js'
import { readLiveParams } from './read-live-params.js'
import { reportLiveErrors } from './report-live-errors.js'
import { runLiveTest } from './run-live-test.js'

/** What the plugin's generated entry hands the live page. */
export interface LivePageOptions {
  /**
   * Imports a test file by its path from the root. The dev server's entry
   * imports it from the page's own origin, and a static build can pass a map
   * of lazy imports.
   */
  importTest(file: string): Promise<unknown>
  /** `test.globals` of the project's config. */
  globals: boolean
  /** How long the arrange phase may take, in ms, when the test sets no timeout of its own. */
  testTimeout: number
}

/**
 * Runs the live page: imports the test file that the URL names, with the
 * shims in place, runs the test's arrange phase and stops at its first
 * render. The component stays mounted and live.
 */
export async function startLivePage(options: LivePageOptions): Promise<void> {
  if (options.globals) {
    installLiveGlobals()
  }

  reportLiveErrors()

  const params = readLiveParams(window.location)

  if ('problem' in params) {
    reportLiveStatus('not-found', params.problem)

    return
  }

  try {
    await options.importTest(params.file)
    await collectLiveSuites()
  } catch (error) {
    reportLiveStatus('import-failed', liveErrorDetail(error))

    return
  }

  const match = findLiveTest(params.path, params.occurrence)

  if (match === null) {
    const name = params.path.join(' > ')

    reportLiveStatus('not-found', `no test ${name} (#${params.occurrence}) in ${params.file}`)

    return
  }

  await runLiveTest(match, options.testTimeout)
}
