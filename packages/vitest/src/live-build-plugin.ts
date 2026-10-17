import { relative } from 'node:path'
import type { Vite } from 'vitest/node'
import { checkLiveEnabled } from './check-live-enabled.js'
import { LIVE_MODULE_IDS } from './live-module-ids.js'
import { livePluginProtocol } from './live-plugin-protocol.js'
import { liveStringLiteral } from './live-string-literal.js'
import { liveTestFilesSource } from './live-test-files-source.js'
import { ProjectPaths } from './project-paths.js'

/** What the plugin of a live build takes from `buildLive()`. */
export interface LiveBuildPluginOptions {
  /** How messages name the config file. */
  configName: string
  /** The test files of the map, as paths from the root with `/`. */
  testFiles: string[]
  /** Takes the live protocol of the project's describeMe() plugin, once the config is resolved. */
  onProtocol(protocol: number): void
}

// The specifier stays in the id and the reason does not, so chunk names stay plain.
const UNLOADABLE = '\0describe-me-live:unloadable:'
// Vite's stand-in for a Node module in a browser build.
const BROWSER_EXTERNAL = '__vite-browser-external'
const NODE_MODULES = /[\\/]node_modules[\\/]/

function isProjectModule(importer: string | undefined): importer is string {
  return importer !== undefined && !importer.startsWith('\0') && !NODE_MODULES.test(importer)
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]
}

/** Whether a log is the bundler's note that it shimmed an export of a stand-in. */
function isShimmedStandIn(log: Vite.Rollup.RollupLog): boolean {
  const text = `${log.message} ${log.exporter ?? ''} ${log.id ?? ''}`

  return /shimmed/i.test(log.message) && text.includes(UNLOADABLE.slice(1))
}

/**
 * The plugin `buildLive()` adds after the project's own. It runs the checks
 * of `createLiveServer()` before anything is bundled, loads the map of test
 * files, and stands in for each import of a project file that does not load
 * in the browser, such as `node:fs`. A stand-in throws when it runs, so only
 * the test files and setup files that import it fail, and the build goes on.
 * Paths in the bundled code are written relative to the root.
 */
export function liveBuildPlugin(options: LiveBuildPluginOptions): Vite.Plugin {
  const reasons = new Map<string, string>()
  const warned = new Set<string>()
  let root = ''
  let paths: ProjectPaths | null = null
  let logger: Vite.Logger | null = null

  function warnOnce(importer: string, specifier: string, reason: string): void {
    const key = JSON.stringify([importer, specifier])

    if (warned.has(key)) {
      return
    }

    warned.add(key)
    logger?.warn(
      `describe-me: ${relative(root, importer)} imports ${specifier}, which does not load in the browser: ${reason}`,
    )
  }

  return {
    name: 'describe-me:live-build',
    enforce: 'pre',

    configResolved(config) {
      options.onProtocol(livePluginProtocol(config.plugins, options.configName))
      checkLiveEnabled(config.plugins, options.configName)
      root = config.root
      paths = new ProjectPaths(config.root)
      logger = config.logger
    },

    async resolveId(source, importer, resolveOptions) {
      if (!isProjectModule(importer)) {
        return null
      }

      let reason: string

      try {
        const resolved = await this.resolve(source, importer, { ...resolveOptions, skipSelf: true })

        if (resolved !== null && !resolved.id.startsWith(BROWSER_EXTERNAL)) {
          return resolved
        }

        reason = resolved === null ? 'it cannot be resolved' : 'it is a Node module'
      } catch (error) {
        reason = firstLine(error)
      }

      const id = `${UNLOADABLE}${source}`

      reasons.set(id, reason)
      warnOnce(importer, source, reason)

      return id
    },

    load(id) {
      if (id === LIVE_MODULE_IDS.testFiles) {
        return liveTestFilesSource(options.testFiles)
      }

      const reason = reasons.get(id)

      if (reason === undefined) {
        return null
      }

      const message = `${id.slice(UNLOADABLE.length)} does not load in the browser: ${reason}`

      return { code: `throw new Error(${liveStringLiteral(message)})\n`, moduleSideEffects: true }
    },

    // React's development JSX keeps the file of each element, and a stand-in's message may name one.
    renderChunk(code) {
      const cleaned = paths?.inText(code) ?? code

      return cleaned === code ? null : { code: cleaned, map: null }
    },

    onLog(level, log) {
      if (level === 'warn' && isShimmedStandIn(log)) {
        return false
      }
    },
  }
}
