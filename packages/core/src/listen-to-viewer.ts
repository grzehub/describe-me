import { applyViewerRequest } from './apply-viewer-request.js'
import { liveState } from './live-state.js'
import { type DarkVariantRoot, VIEWER_MESSAGE_SOURCE } from './types.js'
import { viewerOrigin } from './viewer-origin.js'

const CLASS_NAME = /^[A-Za-z_][\w-]*$/
// Only `data-*`, because an `on*` attribute would run script and `style` or
// `class` would change more than the variant.
const ATTRIBUTE_NAME = /^data-[\w-]+$/
const ATTRIBUTE_VALUE = /^[\w-]+$/
// Holds the page's status. HTML attribute names ignore case.
const STATUS_ATTRIBUTE = 'data-describe-me-live'

type Attribute = NonNullable<DarkVariantRoot['attribute']>

function attributeOf(value: unknown): Attribute | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const { name, value: wanted } = value as Record<string, unknown>

  if (
    typeof name !== 'string' ||
    !ATTRIBUTE_NAME.test(name) ||
    name.toLowerCase() === STATUS_ATTRIBUTE ||
    typeof wanted !== 'string' ||
    !ATTRIBUTE_VALUE.test(wanted)
  ) {
    return null
  }

  return { name, value: wanted }
}

/** The root a request names, `null` for none, or `undefined` when a field is not acceptable. */
function requestedRoot(value: unknown): DarkVariantRoot | null | undefined {
  if (value === null) {
    return null
  }

  if (typeof value !== 'object') {
    return undefined
  }

  const { className, attribute } = value as Record<string, unknown>
  const root: DarkVariantRoot = {}

  if (className !== undefined) {
    if (typeof className !== 'string' || !CLASS_NAME.test(className)) {
      return undefined
    }

    root.className = className
  }

  if (attribute !== undefined) {
    const parsed = attributeOf(attribute)

    if (parsed === null) {
      return undefined
    }

    root.attribute = parsed
  }

  return root.className === undefined && root.attribute === undefined ? null : root
}

/** Only the window that frames the page, from the origin its URL names, may ask anything. */
function fromViewer(event: MessageEvent): boolean {
  const origin = viewerOrigin()

  return (
    window.parent !== window &&
    event.source === window.parent &&
    origin !== null &&
    event.origin === origin
  )
}

function onMessage(event: MessageEvent): void {
  if (!fromViewer(event)) {
    return
  }

  const data: unknown = event.data

  if (typeof data !== 'object' || data === null) {
    return
  }

  const { source, type, root } = data as Record<string, unknown>

  if (source !== VIEWER_MESSAGE_SOURCE || type !== 'dark-variant') {
    return
  }

  const requested = requestedRoot(root)

  if (requested === undefined) {
    return
  }

  const state = liveState()

  state.viewer.requested = requested

  // Before the arrange phase the test may still set the same class itself,
  // and the page must never own what the test set.
  if (state.status !== null) {
    applyViewerRequest()
  }
}

/**
 * Listens to the viewer that frames the live page. A valid `dark-variant`
 * request is held until the page has a status, then applied to `<html>`.
 * Anything else is ignored without a word. Installs once per page, whichever
 * copy of core calls it.
 */
export function listenToViewer(): void {
  const viewer = liveState().viewer

  if (viewer.listening) {
    return
  }

  viewer.listening = true
  window.addEventListener('message', onMessage)
}
