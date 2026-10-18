import type { Vite } from 'vitest/node'
import { LIVE_CONFIG_ENV } from './live-config-env.js'

/** Whether the dev server runs a plugin that has an `apply`. */
function keptByApply(plugin: Vite.Plugin, config: Vite.UserConfig): boolean {
  const apply = plugin.apply

  if (typeof apply === 'function') {
    return Boolean(apply({ ...config, mode: LIVE_CONFIG_ENV.mode }, LIVE_CONFIG_ENV))
  }

  return apply === 'serve'
}

/**
 * The project's plugins as the dev server applies them, flattened the way Vite
 * flattens them, each without `apply`. So the build keeps the half of a split
 * plugin that generates CSS on the dev server. A plugin kept by its `apply`
 * runs without `transformIndexHtml`, which Vite calls without a server in a
 * build.
 */
export async function liveProjectPlugins(
  plugins: Vite.PluginOption[] | undefined,
  config: Vite.UserConfig,
): Promise<Vite.PluginOption[]> {
  const flat: Vite.PluginOption[] = []

  for (const option of plugins ?? []) {
    const plugin = await option

    if (!plugin) {
      continue
    }

    if (Array.isArray(plugin)) {
      flat.push(...(await liveProjectPlugins(plugin, config)))
      continue
    }

    if (!('apply' in plugin) || !plugin.apply) {
      flat.push(plugin)
      continue
    }

    if (keptByApply(plugin, config)) {
      // Not a copy: hooks may hold the plugin object, and every load of the config makes new ones.
      delete plugin.apply
      delete plugin.transformIndexHtml
      flat.push(plugin)
    }
  }

  return flat
}
