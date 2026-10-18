import type { FoundationItem } from './build-foundations-model.js'
import type { SpecimenBuild } from './specimen-build.js'

const LAST_SEGMENT = /[.-]([^.-]+)$/

/**
 * A color ramp: large adjacent chips, each with its step and its value, and
 * the full name in `title`. It wraps at narrow widths.
 */
export function renderRamp(build: SpecimenBuild, items: FoundationItem[]): HTMLElement {
  const ramp = build.make('div', 'fd-ramp')

  for (const item of items) {
    const element = build.tokenElement(item, 'div', 'fd-ramp-step')
    const chip = build.painted('div', 'fd-ramp-chip', { 'background-color': build.paintOf(item) })
    const step = build.make('span', 'fd-step', LAST_SEGMENT.exec(item.name)?.[1] ?? item.name)
    const badge = item.origin === 'default' ? [build.badge()] : []
    element.title = item.name
    element.append(chip, step, ...badge, build.value(item))
    ramp.append(element)
  }

  return ramp
}
