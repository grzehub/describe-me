import type { ViteUserConfig } from 'vitest/config'
import type { EnvironmentProfile } from './environment-profile.js'
import { styledComponentsBrowserBuild } from './styled-components-browser-build.js'

type TestConfig = NonNullable<ViteUserConfig['test']>

/** DOM environments such as jsdom, where tests render through Testing Library. */
export const domProfile: EnvironmentProfile = {
  renderModules: {
    react: {
      original: '@testing-library/react',
      adapter: '@describe-me/react/testing-library',
      live: '@describe-me/react/live-testing-library',
    },
  },
  setupFile: '@describe-me/vitest/setup-dom',
  configFor({ userConfig, options }) {
    const build =
      options.styledComponentsBrowserBuild === false
        ? undefined
        : styledComponentsBrowserBuild(userConfig.root ?? process.cwd())

    const userTest = userConfig.test
    const test: TestConfig = {
      // Testing Library would otherwise unmount in its own afterEach, before the
      // closing frame is taken. The adapter unmounts through the recorder instead.
      env: { RTL_SKIP_AUTO_CLEANUP: 'true' },
    }

    // Vitest stubs CSS imports by default, which would leave every imported
    // stylesheet out of the snapshots. An explicit choice by the user wins.
    if (userTest?.css === undefined) {
      test.css = true
    } else if (userTest.css === false) {
      console.warn(
        'describe-me: `test.css` is false, so imported stylesheets are stubbed and will be missing from the snapshots.',
      )
    }

    if (!build) {
      return { config: { test }, setupWarnings: [] }
    }

    console.info('describe-me: using the browser build of styled-components, for createGlobalStyle')

    return {
      config: { resolve: build.config.resolve, test: { ...test, ...build.config.test } },
      setupWarnings: build.warning ? [build.warning] : [],
    }
  },
}
