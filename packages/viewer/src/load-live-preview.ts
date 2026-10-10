import type { LivePreviewInfo } from '../cli/live-preview-info.js'
import { rerender } from './rerender.js'
import { state } from './state.js'

const POLL_MS = 500
const OFF: LivePreviewInfo = { status: 'off' }

function isWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Anything but a well-formed answer counts as off. */
function previewOf(body: unknown): LivePreviewInfo {
  if (typeof body !== 'object' || body === null) {
    return OFF
  }

  const { status, base, error } = body as Record<string, unknown>

  if (status === 'starting' || status === 'off') {
    return { status }
  }

  if (status === 'error') {
    const reason =
      typeof error === 'string' && error !== '' ? error : 'The live preview did not start'

    return { status, error: reason }
  }

  if (status === 'ready' && isWebUrl(base)) {
    return { status, base }
  }

  return OFF
}

/** Vite answers the viewer's HTML when no CLI serves `__live.json`, so a body that is not JSON is off too. */
async function fetchPreview(): Promise<LivePreviewInfo> {
  try {
    const response = await fetch('__live.json', { cache: 'no-store' })

    return response.ok ? previewOf(await response.json()) : OFF
  } catch {
    return OFF
  }
}

/**
 * Read `__live.json` next to the viewer, again every 500 ms while the preview
 * is starting. The view repaints when the answer changes.
 */
export async function loadLivePreview(): Promise<void> {
  const preview = await fetchPreview()
  const changed = JSON.stringify(preview) !== JSON.stringify(state.preview)

  state.preview = preview

  // Before the manifest, there is nothing to repaint. Its first paint reads the preview.
  if (changed && state.manifest) {
    rerender('frame')
  }

  if (preview.status === 'starting') {
    setTimeout(() => void loadLivePreview(), POLL_MS)
  }
}
