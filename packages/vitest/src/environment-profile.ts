import type { ViteUserConfig } from 'vitest/config'
import type { DescribeMeOptions } from './plugin.js'

/** The render module tests import, and the modules that replace it. */
export interface RenderModule {
  /** The module tests import `render` from. */
  original: string
  /** Our recording adapter for it. */
  adapter: string
  /** The live preview's stand-in for it, which mounts at the first render and stops the test. */
  live: string
}

/** What the plugin hands a profile when it asks for its config. */
export interface ProfileContext {
  userConfig: ViteUserConfig
  options: DescribeMeOptions
  renderModule: RenderModule
}

/** One environment's config, and the setup problems found while building it. */
export interface ProfileConfig {
  config: ViteUserConfig
  /** Handed to the reporter, which writes them to the manifest. */
  setupWarnings: string[]
}

/**
 * Everything describe-me does differently in one environment. The plugin
 * picks a profile and adds what every environment shares.
 */
export interface EnvironmentProfile {
  /** For each framework, the render module tests import and our adapter for it. */
  renderModules: Record<NonNullable<DescribeMeOptions['framework']>, RenderModule>
  /** The setup file that patches interactions and registers the recording hooks. */
  setupFile: string
  /** The rest of the environment's config, built in the plugin's `config` hook. */
  configFor(context: ProfileContext): ProfileConfig
}
