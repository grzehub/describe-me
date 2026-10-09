import type { EnvironmentProfile } from './environment-profile.js'

/** Vitest browser mode, where tests render in a real browser. */
export const browserProfile: EnvironmentProfile = {
  renderModules: {
    react: { original: 'vitest-browser-react', adapter: '@describe-me/react' },
  },
  setupFile: '@describe-me/vitest/setup',
  configFor({ renderModule }) {
    return {
      config: {
        // Vite's dependency scanner runs before our `resolveId` redirect, so it
        // never sees the adapter. Discovering it mid-run makes Vite re-optimize
        // and reload, and the test ends up with two copies of the bundled deps
        // ("Vitest failed to find the runner"). Declaring the adapter up front
        // keeps a single optimization pass.
        optimizeDeps: {
          include: [renderModule.adapter, renderModule.original],
        },
      },
      setupWarnings: [],
    }
  },
}
