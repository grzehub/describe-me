import type { ViteUserConfig } from 'vitest/config'
import { LIVE_PROTOCOL, type RenderFrameMode } from '@describe-me/core/types'
import { adapterPackageRoot } from './adapter-package-root.js'
import { compileGlobs } from './compile-globs.js'
import { compileInclude } from './compile-include.js'
import { defaultReporters } from './default-reporters.js'
import { detectEnvironment } from './detect-environment.js'
import type { RenderModule } from './environment-profile.js'
import { isAdapterModule } from './is-adapter-module.js'
import { LIVE_ENV } from './live-env.js'
import { livePlugin } from './live-plugin.js'
import { loadProfile } from './load-profile.js'
import { packageNameOf } from './package-name-of.js'
import { projectModulePath } from './project-module-path.js'
import { registerExports } from './register-exports.js'
import DescribeMeReporter from './reporter.js'
import { RUNTIME_OPTIONS_KEY, type RuntimeOptions } from './runtime-options.js'
import { validateRenderFrame } from './validate-render-frame.js'

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
   * Applied when styled-components is installed. For 6.0 to 6.3 it also points
   * `tslib` at the `tslib.es6.mjs` they resolve, so the optimizer keeps its
   * exports. Default: true.
   */
  styledComponentsBrowserBuild?: boolean
  /**
   * Test files to record, as globs relative to the Vitest root, matched with
   * picomatch, dotfiles included. Tests in other files still run, but record
   * nothing and leave the manifest. An empty list records no test file and
   * warns. Default: every test file.
   */
  include?: string | string[]
  /** Test files never to record, as globs like `include`. Wins over `include`. Default: none. */
  exclude?: string | string[]
  /**
   * HTML the viewer adds to the start of the `<head>` of every replayed frame,
   * like Storybook's `preview-head.html`. It never reaches the test page.
   * Project files it links are copied into the output directory. Default: none.
   */
  previewHead?: string
  /**
   * When the render frame is taken: `'eager'` right after mount, `'lazy'`
   * before the next interaction, `{ pending }` once nothing matches the
   * selector. Default: `'eager'`.
   */
  renderFrame?: RenderFrameMode
}

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number]

/**
 * One-line integration: `plugins: [describeMe()]`.
 *
 * Registers the setup file and the reporter, and redirects the framework's
 * `render` import to our adapter so existing tests record frames unchanged.
 * Works in browser mode and in DOM environments such as jsdom; the adapter
 * itself still needs the real module, so imports coming from inside it are
 * left alone. While `createLiveServer()` loads the config, it returns the
 * live preview's plugin instead.
 */
export function describeMe(options: DescribeMeOptions = {}): VitePlugin {
  if (process.env[LIVE_ENV] === '1') {
    return livePlugin(options)
  }

  const { enabled = true, framework = 'react', outDir } = options
  // Set by `config()`, which Vite runs before `configResolved` and `resolveId`.
  // Stays null while the plugin is disabled.
  let renderModule: RenderModule | null = null
  // Known once Vite has resolved its config. Vitest always serves; a production
  // build that shares the config must not carry the export registration.
  let root = ''
  let serving = false
  // Where the installed adapter lives, so a user path that merely looks like
  // it (`packages/react/` in a monorepo) is still redirected.
  let adapterRoot: string | null = null

  return {
    name: 'describe-me',
    enforce: 'pre',
    // In both modes, so a tool can check the live protocol on any config it loads.
    api: { live: { protocol: LIVE_PROTOCOL } },

    async config(userConfig: ViteUserConfig): Promise<ViteUserConfig> {
      if (!enabled) {
        return {}
      }

      const environment = options.environment ?? detectEnvironment(userConfig)

      // Checked here, so invalid options fail before any test runs. Vite
      // deep-merges `provide`, so the user's own keys survive.
      const runtimeOptions: RuntimeOptions = {
        include: compileInclude(options.include),
        exclude: compileGlobs(options.exclude),
        renderFrame: validateRenderFrame(options.renderFrame),
      }

      const provide = { [RUNTIME_OPTIONS_KEY]: runtimeOptions }
      const profile = await loadProfile(environment)
      renderModule = profile.renderModules[framework]
      const { config, setupWarnings } = profile.configFor({ userConfig, options, renderModule })

      const reporter = new DescribeMeReporter({
        outDir,
        include: options.include,
        exclude: options.exclude,
        previewHead: options.previewHead,
        setupWarnings,
      })

      // Vite concatenates our list with the user's. Any list replaces the
      // reporters Vitest picks on its own, so without one of the user's, ours
      // joins Vitest's defaults.
      const reporters = userConfig.test?.reporters ? [reporter] : [...defaultReporters(), reporter]

      return {
        ...config,
        test: { setupFiles: [profile.setupFile], ...config.test, reporters, provide },
      }
    },

    async resolveId(source: string, importer: string | undefined) {
      if (!enabled || renderModule === null || source !== renderModule.original) {
        return null
      }

      const fromAdapter =
        importer !== undefined &&
        isAdapterModule(importer, adapterRoot, packageNameOf(renderModule.adapter))

      if (fromAdapter) {
        return null
      }

      const resolved = await this.resolve(renderModule.adapter, importer, { skipSelf: true })

      // Falling back to the original module would look like success while
      // recording nothing, and in a DOM environment it would also leave every
      // test mounted, because Testing Library's auto-cleanup is switched off.
      if (!resolved) {
        throw new Error(
          `describe-me: cannot resolve ${renderModule.adapter} (the recording replacement for ${renderModule.original}). Install ${packageNameOf(renderModule.adapter)}.`,
        )
      }

      return resolved
    },

    configResolved(config) {
      root = config.root
      serving = config.command === 'serve'

      if (renderModule !== null) {
        adapterRoot = adapterPackageRoot(config.root, packageNameOf(renderModule.adapter))
      }
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
