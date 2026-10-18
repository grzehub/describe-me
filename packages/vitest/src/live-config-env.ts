import type { Vite } from 'vitest/node'

/** The env the live preview gives the config file and `apply` functions: a dev server in mode `test`. */
export const LIVE_CONFIG_ENV: Vite.ConfigEnv = {
  command: 'serve',
  mode: 'test',
  isSsrBuild: false,
  isPreview: false,
}
