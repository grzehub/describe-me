import { postLiveMessage } from '@describe-me/core/live'

const posted = new Set<string>()

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function pathOf(path: unknown): string {
  if (typeof path === 'string') {
    return JSON.stringify(path)
  }

  return isThenable(path) ? 'import(…)' : String(path)
}

/**
 * Tells the viewer that a `vi.mock` or `vi.doMock` call has no effect on the
 * live page. Each distinct call posts one notice per page.
 */
export function noticeLiveModuleMock(method: 'vi.mock' | 'vi.doMock', path: unknown): void {
  const message = `${method}(${pathOf(path)}) does not apply in the live preview, so the component uses the real module.`

  if (posted.has(message)) {
    return
  }

  posted.add(message)
  postLiveMessage({ type: 'notice', message })
}
