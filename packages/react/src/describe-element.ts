import type { ReactElement } from 'react'
import { serializeValue, type ComponentInfo } from '@describe-me/core'

/** Pull the component name and JSON-safe props out of a React element. */
export function describeElement(ui: ReactElement): ComponentInfo {
  const type = ui.type as unknown
  const name =
    typeof type === 'string'
      ? type
      : ((type as { displayName?: string })?.displayName ??
        (type as { name?: string })?.name ??
        'Anonymous')
  const props = serializeValue(ui.props ?? {}) as Record<string, unknown>
  return { name, props }
}
