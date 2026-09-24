import type { ViteUserConfig } from 'vitest/config'
import { projectModulePath } from './project-module-path.js'
import { registerExports } from './register-exports.js'
import DescribeMeReporter from './reporter.js'
import { styledComponentsBrowserBuild } from './styled-components-browser-build.js'

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
  /**
   * Register the top-level exports of project modules, so a component is named
   * after its export (`Button`) even when it is an anonymous `forwardRef`,
   * `memo` or styled component, and its props are read from the right file.
   * Default: true.
   */
  registerExports?: boolean
  /**
   * DOM environments only. Load the browser build of styled-components (v5+)
   * instead of the Node one, whose `createGlobalStyle` never inserts its CSS on
   * the client: global resets and fonts would be missing from every snapshot.
   * Applied when styled-components is installed. Default: true.
   */
  styledComponentsBrowserBuild?: boolean
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

function domConfig(userConfig: ViteUserConfig, options: DescribeMeOptions): ViteUserConfig {
  const userTest = userConfig.test
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

  const styledComponents =
    options.styledComponentsBrowserBuild === false
      ? undefined
      : styledComponentsBrowserBuild(userConfig.root ?? process.cwd())

  if (!styledComponents) {
    return { test }
  }

  console.info('describe-me: using the browser build of styled-components, for createGlobalStyle')

  return { resolve: styledComponents.resolve, test: { ...test, ...styledComponents.test } }
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
  // Known once Vite has resolved its config. Vitest always serves; a production
  // build that shares the config must not carry the export registration.
  let root = ''
  let serving = false

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
        environment === 'browser' ? browserConfig(renderModule) : domConfig(userConfig, options)

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

    configResolved(config) {
      root = config.root
      serving = config.command === 'serve'
    },

    // Names components after their export (see registerExports). `order: 'post'`
    // runs it after the TypeScript and JSX transforms, so it parses plain
    // JavaScript, while the plugin as a whole stays `enforce: 'pre'` for the
    // render redirect above.
    transform: {
      order: 'post',
      handler(code, id) {
        if (!enabled || options.registerExports === false || !serving) {
          return null
        }

        const file = projectModulePath(id, root)

        // Without the word `export` there is nothing to register: skip the parse.
        if (file === null || !code.includes('export')) {
          return null
        }

        let snippet: string | null

        // Parse errors are for the user's own tooling to report, and an older
        // Vite may lack `this.parse`. This transform must never be the reason a
        // module fails, so it steps aside instead.
        try {
          snippet = registerExports(this.parse(code), file)
        } catch {
          return null
        }

        if (snippet === null) {
          return null
        }

        // Appending moves no code, so the source maps of earlier transforms stay valid.
        return { code: code + snippet, map: null }
      },
    },
  }
}
