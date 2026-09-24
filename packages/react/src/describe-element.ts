import type { ReactElement } from 'react'
import { describeComponentType, serializeValue, type ComponentInfo } from '@describe-me/core'

/**
 * Pull the component name, its defining file when the plugin registered it,
 * and JSON-safe props out of a React element.
 */
export function describeElement(ui: ReactElement): ComponentInfo {
  const identity = describeComponentType(ui.type)
  const props = serializeValue(ui.props ?? {}) as Record<string, unknown>

  return { ...identity, props }
}
