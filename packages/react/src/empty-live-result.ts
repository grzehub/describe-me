import type { ReactNode } from 'react'
import type { LiveMountOptions } from './mount-live.js'

/** What the live render returns while it has nothing to mount. */
export interface EmptyLiveResult {
  container: Element | DocumentFragment
  baseElement: Element
  rerender(ui: ReactNode): unknown
  unmount(): void
  asFragment(): DocumentFragment
  debug(): void
}

/**
 * The result of a live render that had nothing to mount yet. Its `rerender`
 * renders again into the same container, so the component mounts at the
 * test's rerender.
 */
export function emptyLiveResult(
  options: LiveMountOptions,
  render: (ui: ReactNode, options: LiveMountOptions) => unknown,
): EmptyLiveResult {
  const baseElement = options.baseElement ?? document.body
  const container = options.container ?? baseElement.appendChild(document.createElement('div'))
  const next: LiveMountOptions = { ...options, baseElement, container }

  return {
    container,
    baseElement,
    rerender: (ui) => render(ui, next),
    unmount: () => undefined,
    asFragment: () => document.createDocumentFragment(),
    debug: () => undefined,
  }
}
