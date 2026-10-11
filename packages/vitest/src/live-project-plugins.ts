import type { Vite } from 'vitest/node'

/**
 * The project's plugins for the live build, flattened the way Vite flattens
 * them: nested arrays and promises, without falsy entries. Those whose
 * `apply` is `'build'` are left out, because the dev server never runs them.
 * Vite itself drops those whose `apply` is `'serve'`.
 */
export async function liveProjectPlugins(
  plugins: Vite.PluginOption[] | undefined,
): Promise<Vite.PluginOption[]> {
  const flat: Vite.PluginOption[] = []

  for (const option of plugins ?? []) {
    const plugin = await option

    if (!plugin) {
      continue
    }

    if (Array.isArray(plugin)) {
      flat.push(...(await liveProjectPlugins(plugin)))
      continue
    }

    if (!('apply' in plugin) || plugin.apply !== 'build') {
      flat.push(plugin)
    }
  }

  return flat
}
