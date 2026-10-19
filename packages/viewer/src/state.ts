import type { FoundationGroup, Manifest, ManifestTest } from '@describe-me/core/types'
import type { LivePreviewInfo } from '../cli/live-preview-info.js'
import { MIN_FRAME_HEIGHT } from './min-frame-height.js'
import { parseFoundationsSection } from './parse-foundations-section.js'
import type { StageBackground } from './parse-stage-background.js'
import { parseStageBackground } from './parse-stage-background.js'
import { parseViewportSize } from './parse-viewport-size.js'
import { rerender } from './rerender.js'
import { stateHash } from './state-hash.js'

export interface State {
  manifest: Manifest | null
  testId: string | null
  /** A sidebar suite or module selection; when set, the overview replaces the frame view. */
  suiteKey: string | null
  /**
   * The open section of Foundations, which replaces the frame view.
   * `foundations=` in the link. The selected test is kept, as with an overview.
   */
  foundations: FoundationGroup | null
  frame: number
  /**
   * The selected test mounted live instead of its frame, the default. `live=0`
   * or a `frame` in the link turns it off.
   */
  live: boolean
  /** What `__live.json` says about the live preview. */
  preview: LivePreviewInfo
  /** The replayed page's size in CSS pixels. `null` fits the stage's width or the content's height. */
  viewport: { width: number | null; height: number | null }
  /**
   * The stage's canvas and the frames' color scheme. `bg=` in the link, except
   * for `auto`. Not stored.
   */
  background: StageBackground
  /** Kept here so repaints rebuild the issues panel as it was. */
  issuesOpen: boolean
  /** The stage's zoom, below 1 when the viewport is wider than the stage. */
  scale: number
  /** The sidebar's search. Neither in the link nor stored. */
  query: string
  /** The tag the sidebar is narrowed to. `tag=` in the link, so a filtered list can be shared. */
  tag: string | null
  /** Props tables unfolded with Show N more, by `component:<name>` or `test:<id>`. Neither in the link nor stored. */
  expandedProps: Set<string>
}

export const state: State = {
  manifest: null,
  testId: null,
  suiteKey: null,
  foundations: null,
  frame: 0,
  live: true,
  preview: { status: 'off' },
  viewport: { width: null, height: null },
  background: 'auto',
  issuesOpen: false,
  scale: 1,
  query: '',
  tag: null,
  expandedProps: new Set(),
}

/** Live unless the link names a recorded frame. `live=1`, from links of earlier versions, wins over `frame`. */
function opensLive(params: URLSearchParams): boolean {
  const live = params.get('live')

  if (live === '1') {
    return true
  }

  if (live === '0') {
    return false
  }

  return !params.has('frame')
}

export function readHash(): void {
  const params = new URLSearchParams(location.hash.slice(1))
  state.testId = params.get('test')
  state.suiteKey = params.get('suite')
  state.foundations = parseFoundationsSection(params.get('foundations'))
  state.frame = Number(params.get('frame') ?? 0) || 0
  state.live = opensLive(params)
  state.tag = params.get('tag') || null
  state.viewport = {
    width: parseViewportSize(params.get('w')),
    height: parseViewportSize(params.get('h'), MIN_FRAME_HEIGHT),
  }

  state.background = parseStageBackground(params.get('bg'))
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
 * Show one test. Leaving the overview or Foundations is the whole point, so
 * both are cleared. `mode` goes to `writeHash()`.
 */
export function select(testId: string, frame = 0, mode: 'push' | 'replace' = 'push'): void {
  state.testId = testId
  state.suiteKey = null
  state.foundations = null
  state.frame = frame
  writeHash(mode)
  rerender()
}

/** Narrow the sidebar to the tests with `tag`, or show every test again with `null`. */
export function filterByTag(tag: string | null): void {
  state.tag = tag
  writeHash('push')
  rerender()
}

/** Show the overview of a suite or module. The selected test is kept, so going back works. */
export function selectSuite(key: string): void {
  state.suiteKey = key
  state.foundations = null
  writeHash('push')
  rerender()
}

/** Show a section of Foundations. The selected test is kept, as with an overview. */
export function openFoundations(section: FoundationGroup, mode: 'push' | 'replace'): void {
  state.foundations = section
  state.suiteKey = null
  writeHash(mode)
  rerender()
}
