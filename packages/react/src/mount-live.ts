import { createElement, type ComponentType, type ReactNode } from 'react'
import { createRoot, type RootOptions } from 'react-dom/client'
import { liveStatus, reportLiveStatus } from '@describe-me/core/live'
import { nameLiveMocks } from './name-live-mocks.js'

/** The render options, of either flavour, that the live mount reads. */
export interface LiveMountOptions {
  container?: Element | DocumentFragment
  baseElement?: Element
  wrapper?: ComponentType<{ children?: ReactNode }>
  createRootOptions?: RootOptions
}

type ActEnvironment = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

/**
 * Mounts what a test rendered, in its wrapper, with `createRoot` as Testing
 * Library does, and reports the page as mounted. A page that has a status
 * already mounts nothing. Either way the caller then stops the test.
 */
export function mountLive(ui: ReactNode, options: LiveMountOptions = {}): void {
  if (liveStatus() !== null) {
    return
  }

  nameLiveMocks(ui)

  // Testing Library's own `beforeAll` turns it on, but the live component
  // runs outside `act()`, where React would warn about every update.
  const scope = globalThis as ActEnvironment

  scope.IS_REACT_ACT_ENVIRONMENT = false

  const baseElement = options.baseElement ?? document.body
  const container = options.container ?? baseElement.appendChild(document.createElement('div'))
  const element = options.wrapper === undefined ? ui : createElement(options.wrapper, null, ui)

  createRoot(container, options.createRootOptions).render(element)
  reportLiveStatus('mounted')
}
