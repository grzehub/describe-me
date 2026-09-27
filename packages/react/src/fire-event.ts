import { fireEvent as baseFireEvent } from '@testing-library/react'
import { recorder } from '@describe-me/core'
import { fireEventLabel } from './fire-event-label.js'
import { recordSyncAction } from './record-sync-action.js'

type FireEvent = typeof baseFireEvent
type Target = Parameters<FireEvent>[0]
type EventMethod = (element: Target, init?: object) => boolean

/** Fire through Testing Library, recording a frame only while a test is recorded. */
function fire(label: () => string, dispatch: () => boolean): boolean {
  if (!recorder.isActive) {
    return dispatch()
  }

  return recordSyncAction(label(), dispatch)
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
    )

  const wrappers = recording as unknown as Record<string, EventMethod>

  // Composite events such as `mouseEnter` call Testing Library's own object,
  // not these wrappers, so one call stays one frame.
  for (const name of Object.keys(baseFireEvent)) {
    wrappers[name] = (element, init) =>
      fire(
        () => fireEventLabel(name, element, init),
        () => methods[name](element, init),
      )
  }

  return recording as FireEvent
}

/**
 * Drop-in for `fireEvent` from @testing-library/react: the function and every
 * method record one frame per call, labelled like `click(button "Save")`.
 * The label is read before the event fires, so it names the element the test
 * targeted, not what the event turned it into.
 */
export const fireEvent: FireEvent = recordingFireEvent()
