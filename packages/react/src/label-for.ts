import type { ComponentInfo } from '@describe-me/core'

/** A JSX-looking one-liner for a frame label, e.g. `<Counter initial=1 />`. */
export function labelFor(info: ComponentInfo): string {
  const shown = Object.entries(info.props)
    .filter(
      ([key, value]) =>
        key !== 'children' &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
    )
    .slice(0, 3)
    .map(([key, value]) => (value === true ? key : `${key}=${JSON.stringify(value)}`))

  return `<${info.name}${shown.length ? ' ' + shown.join(' ') : ''} />`
}
