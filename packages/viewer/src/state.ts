import type { Manifest, ManifestTest } from '@describe-me/core/types'
import { rerender } from './rerender.js'

export interface State {
  manifest: Manifest | null
  testId: string | null
  frame: number
  width: 'auto' | '768' | '375'
}

export const state: State = { manifest: null, testId: null, frame: 0, width: 'auto' }

export function readHash(): void {
  const params = new URLSearchParams(location.hash.slice(1))
  state.testId = params.get('test')
  state.frame = Number(params.get('frame') ?? 0) || 0
}

export function writeHash(): void {
  const params = new URLSearchParams()
  if (state.testId) params.set('test', state.testId)
  if (state.frame) params.set('frame', String(state.frame))
  history.replaceState(null, '', `#${params.toString()}`)
}

export function allTests(m: Manifest): ManifestTest[] {
  return m.modules.flatMap((mod) => mod.tests)
}

export function currentTest(): ManifestTest | null {
  if (!state.manifest) return null
  return allTests(state.manifest).find((t) => t.id === state.testId) ?? null
}

export function select(testId: string, frame = 0): void {
  state.testId = testId
  state.frame = frame
  writeHash()
  rerender()
}
