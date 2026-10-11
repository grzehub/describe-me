import type { Manifest, ManifestTest } from '@describe-me/core/types'
import type { LivePreviewInfo } from '../cli/live-preview-info.js'
import { MIN_FRAME_HEIGHT } from './min-frame-height.js'
import { parseViewportSize } from './parse-viewport-size.js'
import { rerender } from './rerender.js'
import { stateHash } from './state-hash.js'

export interface State {
  manifest: Manifest | null
  testId: string | null
  /** A sidebar suite or module selection; when set, the overview replaces the frame view. */
  suiteKey: string | null
  frame: number
  /** The selected test mounted live instead of its frame. `live=1` in the link. */
  live: boolean
  /** What `__live.json` says about the live preview. */
  preview: LivePreviewInfo
  /** The replayed page's size in CSS pixels. `null` fits the stage's width or the content's height. */
  viewport: { width: number | null; height: number | null }
  /** Kept here so repaints rebuild the issues panel as it was. */
  issuesOpen: boolean
  /** The stage's zoom, below 1 when the viewport is wider than the stage. */
  scale: number
  /** The sidebar's search. Neither in the link nor stored. */
  query: string
}

export const state: State = {
  manifest: null,
  testId: null,
  suiteKey: null,
  frame: 0,
  live: false,
  preview: { status: 'off' },
  viewport: { width: null, height: null },
  issuesOpen: false,
  scale: 1,
  query: '',
}

export function readHash(): void {
  const params = new URLSearchParams(location.hash.slice(1))
  state.testId = params.get('test')
  state.suiteKey = params.get('suite')
  state.frame = Number(params.get('frame') ?? 0) || 0
  state.live = params.get('live') === '1'
  state.viewport = {
    width: parseViewportSize(params.get('w')),
    height: parseViewportSize(params.get('h'), MIN_FRAME_HEIGHT),
  }
}

/**
 * Put the view into the link. `'push'` adds a history entry for Back, unless
 * the link would not change. `'replace'` updates the current entry.
 */
export function writeHash(mode: 'push' | 'replace'): void {
  const hash = stateHash(state)
  if (mode === 'push' && hash !== location.hash.slice(1)) {
    history.pushState(null, '', `#${hash}`)
  } else {
    history.replaceState(null, '', `#${hash}`)
  }
}

export function allTests(manifest: Manifest): ManifestTest[] {
  return manifest.modules.flatMap((mod) => mod.tests)
}

export function currentTest(): ManifestTest | null {
  if (!state.manifest) {
    return null
  }

  return allTests(state.manifest).find((test) => test.id === state.testId) ?? null
}

/**
 * Show one test. Leaving the overview is the whole point, so the suite is
 * cleared. `mode` goes to `writeHash()`.
 */
export function select(testId: string, frame = 0, mode: 'push' | 'replace' = 'push'): void {
  state.testId = testId
  state.suiteKey = null
  state.frame = frame
  writeHash(mode)
  rerender()
}

/** Show the overview of a suite or module. The selected test is kept, so going back works. */
export function selectSuite(key: string): void {
  state.suiteKey = key
  writeHash('push')
  rerender()
}
