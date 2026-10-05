import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAgent } from 'std-env'
import { configDefaults } from 'vitest/config'

/**
 * Vitest 4.0 has no `agent` reporter and loads the name as a reporter module,
 * which fails the run. An unreadable version counts as 4.0.
 */
function hasAgentReporter(): boolean {
  try {
    const manifest = createRequire(import.meta.url).resolve('vitest/package.json')
    const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }
    const [major, minor] = version.split('.').map(Number)

    return major > 4 || (major === 4 && minor >= 1)
  } catch {
    return false
  }
}

/**
 * The reporters the installed Vitest uses when the config names none, such as
 * `minimal` for AI agents and `github-actions` in GitHub Actions.
 */
export function defaultReporters(): string[] {
  // Vitest 5 exports the list. Vitest 4 exports none and fills it while
  // resolving the config, only when it is still empty, so its rule is rebuilt here.
  if (configDefaults.reporters.length > 0) {
    return [...configDefaults.reporters]
  }

  const reporters = [isAgent && hasAgentReporter() ? 'agent' : 'default']

  if (process.env.GITHUB_ACTIONS === 'true') {
    reporters.push('github-actions')
  }

  return reporters
}
