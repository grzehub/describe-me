import type { EnvironmentProfile } from './environment-profile.js'
import type { DescribeMeEnvironment } from './plugin.js'

/** Imported on demand, so browser mode never loads the code for DOM environments. */
export async function loadProfile(environment: DescribeMeEnvironment): Promise<EnvironmentProfile> {
  if (environment === 'browser') {
    const { browserProfile } = await import('./browser-profile.js')

    return browserProfile
  }

  const { domProfile } = await import('./dom-profile.js')

  return domProfile
}
