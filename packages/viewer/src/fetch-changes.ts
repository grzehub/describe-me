import type { ChangesReport } from '../cli/changes-report.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isReport(value: unknown): value is ChangesReport {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.tests) &&
    isObject(value.counts) &&
    isObject(value.counts.tests) &&
    isObject(value.base) &&
    isObject(value.head) &&
    typeof value.head.generatedAt === 'string'
  )
}

/**
 * Fetch the report of `describe-me dev --base` or `build --base`, which
 * `index.html` names in a meta tag. Without the tag there is no request.
 * `null` for a failed answer or a body that is no report. Never throws.
 */
export async function fetchChanges(): Promise<ChangesReport | null> {
  const meta = document.querySelector('meta[name="describe-me-changes"]')
  const path = meta?.getAttribute('content')

  if (!path) {
    return null
  }

  try {
    const response = await fetch(path, { cache: 'no-store' })

    if (!response.ok) {
      return null
    }

    const report: unknown = await response.json()

    return isReport(report) ? report : null
  } catch {
    return null
  }
}
