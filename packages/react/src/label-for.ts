import type { ComponentInfo } from '@describe-me/core'

/** A JSX-looking one-liner for a frame label, e.g. `<Counter initial=1 />`. */
export function labelFor(info: ComponentInfo): string {
  const shown = Object.entries(info.props)
    .filter(
      ([k, v]) =>
        k !== 'children' &&
        (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
    )
    .slice(0, 3)
    .map(([k, v]) => (v === true ? k : `${k}=${JSON.stringify(v)}`))
  return `<${info.name}${shown.length ? ' ' + shown.join(' ') : ''} />`
}
