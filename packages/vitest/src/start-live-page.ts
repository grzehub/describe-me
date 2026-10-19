import { listenToViewer, reportLiveStatus } from '@describe-me/core/live'
import { collectLiveSuites } from './collect-live-suites.js'
import { findLiveTest } from './find-live-test.js'
import { installLiveGlobals } from './install-live-globals.js'
import { liveErrorDetail } from './live-error-detail.js'
import { liveRegistry } from './live-registry.js'
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
  /**
   * The setup files to import before the test file, in order: each one's
   * name for messages and its import. Default: none.
   */
  setupFiles?: { file: string; load(): Promise<unknown> }[]
  /** The major version of the project's Vitest, whose rules name `each` and `for` rows. Default: 5. */
  vitestMajor?: number
}

/**
 * Imports the setup files one at a time, as one of the orders Vitest's
 * parallel default can produce. Reports `setup-failed` and returns false at
 * the first one that does not load, link or run.
 */
async function importSetupFiles(setupFiles: LivePageOptions['setupFiles']): Promise<boolean> {
  for (const setupFile of setupFiles ?? []) {
    try {
      await setupFile.load()
    } catch (error) {
      reportLiveStatus('setup-failed', `${setupFile.file}: ${liveErrorDetail(error)}`)

      return false
    }
  }

  return true
}

/**
 * Runs the live page: listens to the viewer, imports the setup files and then
 * the test file that the URL names, with the shims in place, runs the test's
 * arrange phase and stops at its first render. The component stays mounted
 * and live.
 */
export async function startLivePage(options: LivePageOptions): Promise<void> {
  // Before the frame's `load`, after which the viewer posts its requests.
  listenToViewer()

  if (options.globals) {
    installLiveGlobals()
  }

  reportLiveErrors()

  // Names form while tests register, so the rules must be known before any import.
  liveRegistry().vitestMajor = options.vitestMajor ?? 5

  const params = readLiveParams(window.location)

  if ('problem' in params) {
    reportLiveStatus('not-found', params.problem)

    return
  }

  if (!(await importSetupFiles(options.setupFiles))) {
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
