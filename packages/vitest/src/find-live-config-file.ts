import { existsSync } from 'node:fs'
import { join } from 'node:path'

const NAMES = ['vitest.config', 'vite.config']
const EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']

/** The config file Vitest picks in `root` when none is named: `vitest.config.*`, then `vite.config.*`. */
export function findLiveConfigFile(root: string): string {
  for (const name of NAMES) {
    for (const extension of EXTENSIONS) {
      const file = join(root, `${name}.${extension}`)

      if (existsSync(file)) {
        return file
      }
    }
  }

  throw new Error(`describe-me: no Vitest or Vite config file in ${root}`)
}
