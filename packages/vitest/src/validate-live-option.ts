/** The `live` option of `describeMe()`, checked. */
export interface LiveOption {
  enabled: boolean
  /** `live.setupFiles` as a list, or undefined when the option leaves `test.setupFiles` in place. */
  setupFiles?: string[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Checks the `live` option when the live preview starts, so a typo fails
 * there instead of falling back to `test.setupFiles` without a word.
 */
export function validateLiveOption(live: unknown): LiveOption {
  if (live === undefined) {
    return { enabled: true }
  }

  if (live === false) {
    return { enabled: false }
  }

  if (!isPlainObject(live)) {
    throw new Error('describe-me: live must be false or { setupFiles }')
  }

  const { setupFiles } = live

  if (setupFiles === undefined) {
    return { enabled: true }
  }

  if (typeof setupFiles === 'string') {
    return { enabled: true, setupFiles: [setupFiles] }
  }

  if (Array.isArray(setupFiles) && setupFiles.every((entry) => typeof entry === 'string')) {
    return { enabled: true, setupFiles: [...(setupFiles as string[])] }
  }

  throw new Error('describe-me: live.setupFiles must be a string or an array of strings')
}
