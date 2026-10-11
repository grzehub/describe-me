import type { LiveReport, LiveStatus } from '@describe-me/core/types'
import { LIVE_MESSAGE_SOURCE } from '@describe-me/core/types'
import { liveIframe } from './live-iframe.js'
import { liveSession } from './live-session.js'
import { liveShown } from './live-shown.js'
import { liveStatusWords } from './live-status-words.js'
import { rerender } from './rerender.js'
import { paintStage } from './stage.js'
import { state } from './state.js'

const MAX_ACTIONS = 50
const MAX_MESSAGES = 20

/** Only the live frame on the stage, loaded from the preview's origin, may talk to the viewer. */
function fromLiveFrame(event: MessageEvent): boolean {
  const base = state.preview.status === 'ready' ? state.preview.base : undefined

  if (base === undefined) {
    return false
  }

  const iframe = liveIframe()

  return (
    event.origin === new URL(base).origin &&
    iframe !== null &&
    event.source === iframe.contentWindow
  )
}

function isLiveStatus(value: unknown): value is LiveStatus {
  return typeof value === 'string' && value !== 'loading' && Object.hasOwn(liveStatusWords, value)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** The report a message carries, or `null` when a field has the wrong type or the type is unknown. */
function reportOf(data: Record<string, unknown>): LiveReport | null {
  const { type, status, detail, height, name, args, message } = data

  if (type === 'status' && isLiveStatus(status)) {
    if (detail !== undefined && typeof detail !== 'string') {
      return null
    }

    return { type, status, detail }
  }

  if (type === 'size' && typeof height === 'number' && Number.isFinite(height) && height >= 0) {
    return { type, height }
  }

  if (type === 'action' && typeof name === 'string' && isStringList(args)) {
    return { type, name, args }
  }

  if ((type === 'error' || type === 'notice') && typeof message === 'string') {
    return { type, message }
  }

  return null
}

function kept<T>(list: T[], item: T, max: number): T[] {
  return [...list, item].slice(-max)
}

function record(report: LiveReport): void {
  if (report.type === 'status') {
    liveSession.status = report.status
    liveSession.detail = report.detail ?? null
  } else if (report.type === 'size') {
    liveSession.height = report.height
  } else if (report.type === 'action') {
    liveSession.actions = kept(
      liveSession.actions,
      { name: report.name, args: report.args },
      MAX_ACTIONS,
    )
  } else if (report.type === 'error') {
    liveSession.errors = kept(liveSession.errors, report.message, MAX_MESSAGES)
  } else {
    liveSession.notices = kept(liveSession.notices, report.message, MAX_MESSAGES)
  }
}

function onMessage(event: MessageEvent): void {
  if (!fromLiveFrame(event)) {
    return
  }

  const data: unknown = event.data

  if (typeof data !== 'object' || data === null) {
    return
  }

  const fields = data as Record<string, unknown>
  const report = fields.source === LIVE_MESSAGE_SOURCE ? reportOf(fields) : null

  if (report === null) {
    return
  }

  record(report)

  // In an overview the hidden frame keeps posting, and a repaint there rebuilds
  // the gallery. While leaving Live, a repaint would cancel the swap.
  if (!liveShown()) {
    return
  }

  if (report.type === 'size') {
    void paintStage()
  } else {
    rerender('frame')
  }
}

/**
 * Listen to the live frame on the stage: its status, size, actions, errors
 * and notices go into the live session. Installed once, at startup.
 */
export function listenToLive(): void {
  window.addEventListener('message', onMessage)
}
