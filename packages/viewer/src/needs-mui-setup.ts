import type { Foundations } from '@describe-me/core/types'
import type { CustomProperty } from './read-custom-properties.js'

/**
 * Whether a project uses Material UI but the view has no way to read its
 * theme: no theme module and no `--mui-*` custom property in the token sheets.
 * It depends on the file alone, so it holds on a page without tokens too.
 */
export function needsMuiSetup(file: Foundations, properties: readonly CustomProperty[]): boolean {
  const usesMui = file.systems.some((system) => system.id === 'mui')

  if (!usesMui || file.theme) {
    return false
  }

  return !properties.some((property) => property.name.startsWith('--mui-'))
}
