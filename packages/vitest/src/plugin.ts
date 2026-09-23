import type { ViteUserConfig } from 'vitest/config'
import DescribeMeReporter from './reporter.js'

/** Where the tests run: Vitest browser mode, or a simulated DOM such as jsdom. */
export type DescribeMeEnvironment = 'browser' | 'dom'

export interface DescribeMeOptions {
  /** Set to false to run the same tests without recording, e.g. for benchmarks. Default: true. */
  enabled?: boolean
  /** Which framework adapter replaces the test-library `render`. Default: 'react'. */
  framework?: 'react'
  /**
   * Which environment the tests run in. Default: detected, `browser` when
   * `test.browser.enabled` is set and `dom` otherwise.
   */
  environment?: DescribeMeEnvironment
  /** Output directory, relative to the Vitest root. Default: `.describe-me`. */
  outDir?: string
}

interface RenderModule {
  /** The module tests import `render` from. */
  original: string
  /** Our recording adapter for it. */
  adapter: string
}

/** For each framework and environment: the render module tests import, and our adapter that wraps it. */
const RENDER_MODULES: Record<'react', Record<DescribeMeEnvironment, RenderModule>> = {
  react: {
    browser: { original: 'vitest-browser-react', adapter: '@describe-me/react' },
    dom: { original: '@testing-library/react', adapter: '@describe-me/react/testing-library' },
  },
}

/** Paths an adapter's own files live under, published or in this workspace. */
const ADAPTER_PATHS = ['/@describe-me/react/', '/packages/react/']

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number]
type TestConfig = NonNullable<ViteUserConfig['test']>

function detectEnvironment(userConfig: ViteUserConfig): DescribeMeEnvironment {
  return userConfig.test?.browser?.enabled ? 'browser' : 'dom'
}

function browserConfig(renderModule: RenderModule): ViteUserConfig {
  return {
    // Vite's dependency scanner runs before our `resolveId` redirect, so it
    // never sees the adapter. Discovering it mid-run makes Vite re-optimize
    // and reload, and the test ends up with two copies of the bundled deps
    // ("Vitest failed to find the runner"). Declaring the adapter up front
    // keeps a single optimization pass.
    optimizeDeps: {
      include: [renderModule.adapter, renderModule.original],
    },
    test: {
      setupFiles: ['@describe-me/vitest/setup'],
    },
  }
}

function domConfig(userTest: TestConfig | undefined): ViteUserConfig {
  const test: TestConfig = {
    setupFiles: ['@describe-me/vitest/setup-dom'],
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

  return { test }
}

/**
 * One-line integration: `plugins: [describeMe()]`.
 *
 * Registers the setup file and the reporter, and redirects the framework's
 * `render` import to our adapter so existing tests record frames unchanged.
 * Works in browser mode and in DOM environments such as jsdom; the adapter
 * itself still needs the real module, so imports coming from inside it are
 * left alone.
 */
export function describeMe(options: DescribeMeOptions = {}): VitePlugin {
  const { enabled = true, framework = 'react', outDir } = options
  let renderModule: RenderModule = RENDER_MODULES[framework].browser

  return {
    name: 'describe-me',
    enforce: 'pre',

    config(userConfig: ViteUserConfig): ViteUserConfig {
      if (!enabled) {
        return {}
      }

      const environment = options.environment ?? detectEnvironment(userConfig)
      renderModule = RENDER_MODULES[framework][environment]

      const reporter = new DescribeMeReporter({ outDir })
      // Vite concatenates arrays when merging, so only add `default` when the
      // user has not chosen their own reporters; otherwise they would lose it.
      const reporters = userConfig.test?.reporters ? [reporter] : ['default', reporter]

      const config =
        environment === 'browser' ? browserConfig(renderModule) : domConfig(userConfig.test)

      return { ...config, test: { ...config.test, reporters } }
    },

    async resolveId(source: string, importer: string | undefined) {
      if (!enabled || source !== renderModule.original) {
        return null
      }

      const fromAdapter =
        importer !== undefined &&
        (importer.includes(renderModule.adapter) ||
          ADAPTER_PATHS.some((path) => importer.includes(path)))

      if (fromAdapter) {
        return null
      }

      const resolved = await this.resolve(renderModule.adapter, importer, { skipSelf: true })

      // Falling back to the original module would look like success while
      // recording nothing, and in a DOM environment it would also leave every
      // test mounted, because Testing Library's auto-cleanup is switched off.
      if (!resolved) {
        throw new Error(
          `describe-me: cannot resolve ${renderModule.adapter} (the recording replacement for ${renderModule.original}). Install ${renderModule.adapter.split('/').slice(0, 2).join('/')}.`,
        )
      }

      return resolved
    },
  }
}
