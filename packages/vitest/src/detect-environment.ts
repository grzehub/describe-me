import type { ViteUserConfig } from 'vitest/config'
import type { DescribeMeEnvironment } from './plugin.js'

/** The environment the tests run in, when the `environment` option does not say. */
export function detectEnvironment(userConfig: ViteUserConfig): DescribeMeEnvironment {
  return userConfig.test?.browser?.enabled ? 'browser' : 'dom'
}
