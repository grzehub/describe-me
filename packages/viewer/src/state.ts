import type { Manifest, ManifestTest } from '@describe-me/core/types'
import { parseViewportSize } from './parse-viewport-size.js'
import { rerender } from './rerender.js'

export interface State {
  manifest: Manifest | null
  testId: string | null
  /** A sidebar suite or module selection; when set, the overview replaces the frame view. */
  suiteKey: string | null
  frame: number
  /** The replayed page's size in CSS pixels. `null` fits the stage's width or the content's height. */
  viewport: { width: number | null; height: number | null }
  /** Kept here so repaints rebuild the issues panel as it was. */
  issuesOpen: boolean
  /** The stage's zoom, below 1 when the viewport is wider than the stage. */
  scale: number
}

export const state: State = {
  manifest: null,
  testId: null,
  suiteKey: null,
  frame: 0,
  viewport: { width: null, height: null },
  issuesOpen: false,
  scale: 1,
}

export function readHash(): void {
  const params = new URLSearchParams(location.hash.slice(1))
  state.testId = params.get('test')
  state.suiteKey = params.get('suite')
  state.frame = Number(params.get('frame') ?? 0) || 0
  state.viewport = {
    width: parseViewportSize(params.get('w')),
    height: parseViewportSize(params.get('h')),
  }
}

export function writeHash(): void {
  const params = new URLSearchParams()
  if (state.suiteKey) {
    params.set('suite', state.suiteKey)
  }

  if (state.testId) {
    params.set('test', state.testId)
  }

  if (state.frame) {
    params.set('frame', String(state.frame))
  }

  if (state.viewport.width !== null) {
    params.set('w', String(state.viewport.width))
  }

  if (state.viewport.height !== null) {
    params.set('h', String(state.viewport.height))
  }

  history.replaceState(null, '', `#${params.toString()}`)
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

/** Show one test. Leaving the overview is the whole point, so the suite is cleared. */
export function select(testId: string, frame = 0): void {
  state.testId = testId
  state.suiteKey = null
  state.frame = frame
  writeHash()
  rerender()
}

/** Show the overview of a suite or module. The selected test is kept, so going back works. */
export function selectSuite(key: string): void {
  state.suiteKey = key
  writeHash()
  rerender()
}
