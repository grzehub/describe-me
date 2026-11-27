import type { FrameChange, TestChange } from './changes-report.js'
import { countText } from './count-text.js'
import { listText } from './list-text.js'
import type { TextFormat } from './text-format.js'

/** `2 frames changed, 1 added and 1 removed`, the noun on the first number. */
function framesText(frames: FrameChange[]): string | undefined {
  const parts: string[] = []

  for (const change of ['changed', 'added', 'removed'] as const) {
    const count = frames.filter((frame) => frame.change === change).length

    if (count > 0) {
      parts.push(
        parts.length === 0 ? `${countText(count, 'frame')} ${change}` : `${count} ${change}`,
      )
    }
  }

  return parts.length === 0 ? undefined : listText(parts)
}

function movedText(test: TestChange, format: TextFormat): string | undefined {
  if (test.from === undefined) {
    return undefined
  }

  const { fullName, module } = test.from

  if (module === test.module) {
    return `was ${format.code(fullName)}`
  }

  if (fullName === test.fullName) {
    return `was in ${format.code(module)}`
  }

  return `was ${format.code(fullName)} in ${format.code(module)}`
}

/**
 * One test of a report as a list item, without the module: its full name,
 * how many frames changed, were added and were removed, a state change, and
 * where a moved test was. Added and removed tests show their name only.
 */
export function testChangeText(test: TestChange, format: TextFormat): string {
  const name = format.code(test.fullName)

  if (test.change === 'added' || test.change === 'removed') {
    return name
  }

  const details = [
    framesText(test.frames),
    test.state === undefined
      ? undefined
      : `state ${format.code(test.state.base)} → ${format.code(test.state.head)}`,
  ].filter((detail) => detail !== undefined)

  const was = movedText(test, format)
  const named = was === undefined ? name : `${name}, ${was}`

  return details.length === 0 ? named : `${named}: ${details.join(', ')}`
}
