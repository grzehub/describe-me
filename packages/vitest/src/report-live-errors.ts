import { isLiveStop, postLiveMessage } from '@describe-me/core/live'

function messageOf(reason: unknown): string {
  return reason instanceof Error ? String(reason) : `Unhandled rejection: ${String(reason)}`
}

/**
 * Reports what the live component throws while someone uses it. The stop
 * signal is no error, so it is neither reported nor logged.
 */
export function reportLiveErrors(): void {
  window.addEventListener('error', (event) => {
    if (isLiveStop(event.error)) {
      event.preventDefault()

      return
    }

    postLiveMessage({ type: 'error', message: event.message || String(event.error) })
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isLiveStop(event.reason)) {
      event.preventDefault()

      return
    }

    postLiveMessage({ type: 'error', message: messageOf(event.reason) })
  })
}
