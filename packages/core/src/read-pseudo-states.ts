import type { PseudoState, RecorderEnvironment } from './types.js'

/** What the test's gestures left behind, as `recorder.noteGesture()` keeps it. */
export interface GestureState {
  /** The test's last pointer gesture was a hover. */
  hovering: boolean
  /** The element the pointer rests on, which DOM environments read. */
  target: Element | null
  /** A keyboard gesture came after the last pointer gesture. */
  keyboard: boolean
}

/** The `type` property of an input reads `text` for a missing or unknown type. */
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** jsdom has no `isContentEditable`, so the attribute decides. */
function acceptsText(element: Element): boolean {
  if (element.localName === 'textarea') {
    return true
  }

  if (element.localName === 'input') {
    return TEXT_TYPES.has((element as HTMLInputElement).type)
  }

  const editable = element.getAttribute('contenteditable')

  return editable !== null && editable.toLowerCase() !== 'false'
}

function focusedElement(): Element | null {
  const active = document.activeElement

  if (active === null || active === document.body || active === document.documentElement) {
    return null
  }

  return active
}

/** An engine without `:focus-visible` throws on the selector. */
function matchesFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return false
  }
}

function isFocusVisible(
  element: Element,
  environment: RecorderEnvironment,
  gestures: GestureState,
): boolean {
  if (environment === 'browser') {
    return matchesFocusVisible(element)
  }

  return acceptsText(element) || gestures.keyboard
}

function selfAndAncestors(element: Element): Element[] {
  const chain: Element[] = []

  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    chain.push(current)
  }

  return chain
}

/**
 * A click leaves the pointer over its target, also from an earlier test, so
 * the browser's hover counts only after a hover gesture. Without one, no
 * capture runs the query.
 */
function hoveredElements(environment: RecorderEnvironment, gestures: GestureState): Element[] {
  if (!gestures.hovering) {
    return []
  }

  if (environment === 'browser') {
    try {
      return Array.from(document.querySelectorAll(':hover'))
    } catch {
      return []
    }
  }

  const { target } = gestures

  return target !== null && target.isConnected ? selfAndAncestors(target) : []
}

function addState(states: Map<Element, PseudoState[]>, element: Element, state: PseudoState): void {
  const names = states.get(element)

  if (names === undefined) {
    states.set(element, [state])
  } else {
    names.push(state)
  }
}

/**
 * The elements in `:hover`, `:focus`, `:focus-visible` or `:focus-within`
 * right now, each with its states in the order `hover focus focus-visible
 * focus-within`. In browser mode the browser decides hover and
 * `:focus-visible`. A DOM environment has neither a pointer nor the browser's
 * focus heuristics, so it follows the gestures the adapters noted.
 */
export function readPseudoStates(
  environment: RecorderEnvironment,
  gestures: GestureState,
): Map<Element, PseudoState[]> {
  const states = new Map<Element, PseudoState[]>()

  for (const element of hoveredElements(environment, gestures)) {
    addState(states, element, 'hover')
  }

  const focused = focusedElement()

  if (focused === null) {
    return states
  }

  addState(states, focused, 'focus')

  if (isFocusVisible(focused, environment, gestures)) {
    addState(states, focused, 'focus-visible')
  }

  for (const element of selfAndAncestors(focused)) {
    addState(states, element, 'focus-within')
  }

  return states
}
