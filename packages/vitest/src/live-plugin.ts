import { resolve } from 'node:path'
import type { ViteUserConfig } from 'vitest/config'
import { LIVE_PROTOCOL } from '@describe-me/core/types'
import { adapterPackageRoot } from './adapter-package-root.js'
import { detectEnvironment } from './detect-environment.js'
import type { RenderModule } from './environment-profile.js'
import { isAdapterModule } from './is-adapter-module.js'
import { liveEntrySource } from './live-entry-source.js'
import { LIVE_MODULE_IDS } from './live-module-ids.js'
import { liveOptimizeDeps } from './live-optimize-deps.js'
import { livePageMiddleware } from './live-page-middleware.js'
import { livePageSettings, type LivePageSettings } from './live-page-settings.js'
import { liveShimSource } from './live-shim-source.js'
import { loadProfile } from './load-profile.js'
import { packageNameOf } from './package-name-of.js'
import type { DescribeMeOptions } from './plugin.js'

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number]

/** What the live page imports instead of each module, by the specifier tests use. */
const SHIMS = new Map<string, string>([
  ['vitest', LIVE_MODULE_IDS.vitest],
  ['vitest/browser', LIVE_MODULE_IDS.vitestBrowser],
  ['@vitest/browser/context', LIVE_MODULE_IDS.vitestBrowser],
  ['@describe-me/vitest', LIVE_MODULE_IDS.describeMeVitest],
])

const GENERATED = new Set<string>(Object.values(LIVE_MODULE_IDS))

/** The source of a generated module. */
function generatedSource(id: string, settings: LivePageSettings): string | null {
  if (id === LIVE_MODULE_IDS.entry) {
    return liveEntrySource(settings.globals, settings.testTimeout)
  }

  if (id === LIVE_MODULE_IDS.vitest) {
    return liveShimSource('vitest', settings.vitestNames)
  }

  if (id === LIVE_MODULE_IDS.vitestBrowser) {
    return liveShimSource('vitest/browser', settings.browserNames)
  }

  if (id === LIVE_MODULE_IDS.describeMeVitest) {
    return liveShimSource('@describe-me/vitest', ['step', 'recorder'])
  }

  return null
}

/**
 * All the config that live mode adds: the dependencies to bundle up front and
 * `test.alias`, which Vitest's own `config` hook moves to `resolve.alias`.
 */
function liveConfig(
  userConfig: ViteUserConfig,
  root: string,
  outDir: string | undefined,
  live: string,
): ViteUserConfig {
  const config: ViteUserConfig = { optimizeDeps: liveOptimizeDeps(root, outDir, live) }
  const alias = userConfig.test?.alias

  if (alias !== undefined) {
    config.resolve = { alias }
  }

  return config
}

/**
 * `describeMe()` while `createLiveServer()` loads the project's config. It
 * serves the live page and swaps `vitest`, `vitest/browser`,
 * `@describe-me/vitest` and the render module for the live page's shims. It
 * adds no setup file, reporter or recording redirect, and ignores `enabled`.
 */
export function livePlugin(options: DescribeMeOptions): VitePlugin {
  const { framework = 'react' } = options
  // Set by `config()`, which Vite runs before `configResolved`, `resolveId` and `load`.
  let renderModule: RenderModule | null = null
  let settings: LivePageSettings | null = null
  // Where the installed live module lives. Its own import of the original stays unredirected.
  let adapterRoot: string | null = null

  return {
    name: 'describe-me',
    enforce: 'pre',
    api: { live: { protocol: LIVE_PROTOCOL } },

    async config(userConfig: ViteUserConfig): Promise<ViteUserConfig> {
      const root = resolve(userConfig.root ?? process.cwd())
      const environment = options.environment ?? detectEnvironment(userConfig)
      const profile = await loadProfile(environment)

      renderModule = profile.renderModules[framework]
      settings = await livePageSettings(userConfig, root)

      return liveConfig(userConfig, root, options.outDir, renderModule.live)
    },

    configResolved(config) {
      if (renderModule !== null) {
        adapterRoot = adapterPackageRoot(config.root, packageNameOf(renderModule.live))
      }
    },

    async resolveId(source: string, importer: string | undefined) {
      if (GENERATED.has(source)) {
        return source
      }

      const shim = SHIMS.get(source)

      if (shim !== undefined) {
        return shim
      }

      if (renderModule === null || source !== renderModule.original) {
        return null
      }

      const fromAdapter =
        importer !== undefined &&
        isAdapterModule(importer, adapterRoot, packageNameOf(renderModule.live))

      if (fromAdapter) {
        return null
      }

      const resolved = await this.resolve(renderModule.live, importer, { skipSelf: true })

      if (!resolved) {
        throw new Error(
          `describe-me: cannot resolve ${renderModule.live} (the live preview's stand-in for ${renderModule.original}). Install ${packageNameOf(renderModule.live)}.`,
        )
      }

      return resolved
    },

    load(id: string) {
      return settings === null ? null : generatedSource(id, settings)
    },

    configureServer(server) {
      server.middlewares.use(livePageMiddleware(server, options.previewHead))
    },
  }
}
