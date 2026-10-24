import { fireEvent as baseFireEvent } from '@testing-library/react'
import { recorder } from '@describe-me/core'
import { fireEventLabel } from './fire-event-label.js'
import { recordSyncAction, type SyncGesture } from './record-sync-action.js'

type FireEvent = typeof baseFireEvent
type Target = Parameters<FireEvent>[0]
type EventMethod = (element: Target, init?: object) => boolean

const HOVER_EVENTS = new Set(['mouseenter', 'mouseover', 'pointerenter', 'pointerover'])
const UNHOVER_EVENTS = new Set(['mouseleave', 'mouseout', 'pointerleave', 'pointerout'])

/**
 * A DOM environment has no pointer, so these events decide what a frame shows
 * hovered. Methods (`mouseEnter`) and event types (`mouseenter`) differ in case only.
 */
function eventGesture(name: string, element: Target): SyncGesture | undefined {
  const type = name.toLowerCase()

  if (HOVER_EVENTS.has(type)) {
    const isElement = typeof Element !== 'undefined' && element instanceof Element

    return isElement ? { kind: 'hover', target: element } : undefined
  }

  return UNHOVER_EVENTS.has(type) ? { kind: 'unhover' } : undefined
}

/** Fire through Testing Library, recording a frame only while a test is recorded. */
function fire(label: () => string, dispatch: () => boolean, gesture?: SyncGesture): boolean {
  if (!recorder.isActive) {
    return dispatch()
  }

  return recordSyncAction(label(), dispatch, gesture)
}

/** `fireEvent(element, event)` is named after the event it dispatches. */
function eventName(event: unknown): string {
  const type = (event as { type?: unknown } | null)?.type

  return typeof type === 'string' ? type : 'fireEvent'
}

/** Testing Library's `fireEvent` with the function and each of its methods wrapped. */
function recordingFireEvent(): FireEvent {
  const methods = baseFireEvent as unknown as Record<string, EventMethod>

  const recording = (element: Target, event: Event): boolean =>
    fire(
      () => fireEventLabel(eventName(event), element),
      () => baseFireEvent(element, event),
      eventGesture(eventName(event), element),
    )

  const wrappers = recording as unknown as Record<string, EventMethod>

  // Composite events such as `mouseEnter` call Testing Library's own object,
  // not these wrappers, so one call stays one frame.
  for (const name of Object.keys(baseFireEvent)) {
    wrappers[name] = (element, init) =>
      fire(
        () => fireEventLabel(name, element, init),
        () => methods[name](element, init),
        eventGesture(name, element),
      )
  }

  return recording as FireEvent
}

/**
 * Drop-in for `fireEvent` from @testing-library/react: the function and every
 * method record one frame per call, labelled like `click(button "Save")`.
 * The label is read before the event fires, so it names the element the test
 * targeted, not what the event turned it into. The enter and over events
 * hover their element in the frame, and the leave and out events end that.
 */
export const fireEvent: FireEvent = recordingFireEvent()
