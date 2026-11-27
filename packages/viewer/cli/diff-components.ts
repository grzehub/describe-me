import type { ComponentDoc, PropDoc } from '@describe-me/core/types'
import type { ComponentChange, PropChange, PropSide } from './changes-report.js'

function propsOf(doc: ComponentDoc | undefined): PropDoc[] {
  return Array.isArray(doc?.props) ? doc.props : []
}

function sideOf(prop: PropDoc): PropSide {
  const side: PropSide = { type: String(prop.type), required: prop.required === true }

  if (prop.defaultValue !== undefined) {
    side.defaultValue = String(prop.defaultValue)
  }

  return side
}

function sameSide(base: PropSide, head: PropSide): boolean {
  return (
    base.type === head.type &&
    base.required === head.required &&
    base.defaultValue === head.defaultValue
  )
}

function diffProps(base: PropDoc[], head: PropDoc[]): PropChange[] {
  const baseByName = new Map(base.map((prop) => [prop.name, prop]))
  const headNames = new Set(head.map((prop) => prop.name))
  const changes: PropChange[] = []

  for (const prop of head) {
    const before = baseByName.get(prop.name)

    if (before === undefined) {
      changes.push({ name: prop.name, change: 'added', head: sideOf(prop) })
      continue
    }

    const baseSide = sideOf(before)
    const headSide = sideOf(prop)

    if (!sameSide(baseSide, headSide)) {
      changes.push({ name: prop.name, change: 'changed', base: baseSide, head: headSide })
    }
  }

  for (const prop of base) {
    if (!headNames.has(prop.name)) {
      changes.push({ name: prop.name, change: 'removed', base: sideOf(prop) })
    }
  }

  return changes
}

/**
 * The props that differ for every component on both sides, components by
 * name, props in head order and then the removed ones in base order. A
 * component on one side only is left out, because its tests show it.
 * `description`, `kind` and `values` do not count.
 */
export function diffComponents(
  base: Record<string, ComponentDoc>,
  head: Record<string, ComponentDoc>,
): ComponentChange[] {
  const names = Object.keys(head)
    .filter((name) => Object.hasOwn(base, name))
    .sort((left, right) => (left < right ? -1 : Number(left > right)))

  const changes: ComponentChange[] = []

  for (const name of names) {
    const props = diffProps(propsOf(base[name]), propsOf(head[name]))

    if (props.length > 0) {
      changes.push({ name, props })
    }
  }

  return changes
}
