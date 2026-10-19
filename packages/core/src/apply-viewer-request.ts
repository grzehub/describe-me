import type { AppliedViewerRoot } from './live-state.js'
import { liveState } from './live-state.js'
import type { DarkVariantRoot } from './types.js'

function sameRoot(first: DarkVariantRoot | null, second: DarkVariantRoot | null): boolean {
  return (
    first?.className === second?.className &&
    first?.attribute?.name === second?.attribute?.name &&
    first?.attribute?.value === second?.attribute?.value
  )
}

function takeBack(root: HTMLElement, applied: AppliedViewerRoot): void {
  if (applied.addedClass !== null) {
    root.classList.remove(applied.addedClass)
  }

  const attribute = applied.attribute

  if (attribute === null) {
    return
  }

  if (attribute.previous === null) {
    root.removeAttribute(attribute.name)
  } else {
    root.setAttribute(attribute.name, attribute.previous)
  }
}

function apply(root: HTMLElement, request: DarkVariantRoot): AppliedViewerRoot {
  const { className, attribute } = request
  const addedClass =
    className !== undefined && !root.classList.contains(className) ? className : null

  if (addedClass !== null) {
    root.classList.add(addedClass)
  }

  if (!attribute) {
    return { root: request, addedClass, attribute: null }
  }

  const previous = root.getAttribute(attribute.name)

  root.setAttribute(attribute.name, attribute.value)

  return { root: request, addedClass, attribute: { name: attribute.name, previous } }
}

/**
 * Puts the viewer's held request on `<html>`, after taking back what the last
 * one applied. Only what the page applied itself comes off, so a class or an
 * attribute the test set stays. A request equal to the applied one changes
 * nothing.
 */
export function applyViewerRequest(): void {
  const viewer = liveState().viewer

  if (sameRoot(viewer.requested, viewer.applied?.root ?? null)) {
    return
  }

  const root = document.documentElement

  if (viewer.applied) {
    takeBack(root, viewer.applied)
  }

  viewer.applied = viewer.requested ? apply(root, viewer.requested) : null
}
