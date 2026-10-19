import type { DarkVariantRoot } from '@describe-me/core/types'

interface Applied {
  root: DarkVariantRoot
  /** The class it added, or `null` when the root already had it. */
  addedClass: string | null
  /** The attribute it set, with the value it replaced, `null` when there was none. */
  attribute: { name: string; previous: string | null } | null
}

const appliedTo = new WeakMap<Document, Applied>()

function sameRoot(first: DarkVariantRoot | null, second: DarkVariantRoot | null): boolean {
  return (
    first?.className === second?.className &&
    first?.attribute?.name === second?.attribute?.name &&
    first?.attribute?.value === second?.attribute?.value
  )
}

function takeBack(root: HTMLElement, applied: Applied): void {
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

function apply(root: HTMLElement, variant: DarkVariantRoot): Applied {
  const { className, attribute } = variant
  const addedClass =
    className !== undefined && !root.classList.contains(className) ? className : null

  if (addedClass !== null) {
    root.classList.add(addedClass)
  }

  if (!attribute) {
    return { root: variant, addedClass, attribute: null }
  }

  const previous = root.getAttribute(attribute.name)

  root.setAttribute(attribute.name, attribute.value)

  return { root: variant, addedClass, attribute: { name: attribute.name, previous } }
}

/**
 * Put the class and attribute of a dark variant on the root of a same-origin
 * document, after taking back what the last call applied to it. Only what it
 * applied comes off, so a frame recorded in its dark variant stays dark. A
 * repeated request writes nothing, because the stage asks on every resize.
 */
export function applyDarkVariant(doc: Document, root: DarkVariantRoot | null): void {
  const applied = appliedTo.get(doc) ?? null

  if (sameRoot(root, applied?.root ?? null)) {
    return
  }

  if (applied) {
    takeBack(doc.documentElement, applied)
  }

  if (root) {
    appliedTo.set(doc, apply(doc.documentElement, root))
  } else {
    appliedTo.delete(doc)
  }
}
