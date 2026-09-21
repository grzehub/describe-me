import type { ViteUserConfig } from 'vitest/config'
import DescribeMeReporter from './reporter.js'

export interface DescribeMeOptions {
  /** Set to false to run the same tests without recording, e.g. for benchmarks. Default: true. */
  enabled?: boolean
  /** Which framework adapter replaces the test-library `render`. Default: 'react'. */
  framework?: 'react'
  /** Output directory, relative to the Vitest root. Default: `.describe-me`. */
  outDir?: string
}

/** For each framework: the render module tests import, and our adapter that wraps it. */
const RENDER_MODULES = {
  react: { original: 'vitest-browser-react', adapter: '@describe-me/react' },
} as const

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number]

/**
 * One-line integration: `plugins: [describeMe()]`.
 *
 * Registers the setup file and the reporter, and redirects the framework's
 * `render` import to our adapter so existing tests record frames unchanged.
 * The adapter itself still needs the real module, so imports coming from
 * inside it are left alone.
 */
export function describeMe(options: DescribeMeOptions = {}): VitePlugin {
  const { enabled = true, framework = 'react', outDir } = options
  const { original, adapter } = RENDER_MODULES[framework]

  return {
    name: 'describe-me',
    enforce: 'pre',

    config(userConfig: ViteUserConfig): ViteUserConfig {
      if (!enabled) {
        return {}
      }

      const reporter = new DescribeMeReporter({ outDir })
      // Vite concatenates arrays when merging, so only add `default` when the
      // user has not chosen their own reporters; otherwise they would lose it.
      const reporters = userConfig.test?.reporters ? [reporter] : ['default', reporter]

      return {
        // Vite's dependency scanner runs before our `resolveId` redirect, so it
        // never sees the adapter. Discovering it mid-run makes Vite re-optimize
        // and reload, and the test ends up with two copies of the bundled deps
        // ("Vitest failed to find the runner"). Declaring the adapter up front
        // keeps a single optimization pass.
        optimizeDeps: {
          include: [adapter, original],
        },
        test: {
          setupFiles: ['@describe-me/vitest/setup'],
          reporters,
        },
      }
    },

    resolveId(source: string, importer: string | undefined) {
      if (!enabled || source !== original) {
        return null
      }

      const fromAdapter =
        importer !== undefined &&
        (importer.includes(adapter) || importer.includes('/packages/react/'))

      if (fromAdapter) {
        return null
      }

      return this.resolve(adapter, importer, { skipSelf: true })
    },
  }
}
