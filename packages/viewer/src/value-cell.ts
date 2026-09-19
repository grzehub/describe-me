import { el } from './el.js'

/** Render one serialized prop value, coloured by its type. */
export function valueCell(value: unknown): HTMLElement {
  if (typeof value === 'string') {
    if (value.startsWith('ƒ ')) {
      return el('span', { class: 'val-fn' }, value)
    }

    return el('span', { class: 'val-string' }, JSON.stringify(value))
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return el('span', { class: `val-${typeof value}` }, String(value))
  }

  if (value === null || value === undefined) {
    return el('span', { class: 'val-fn' }, String(value))
  }

  return el('span', {}, JSON.stringify(value))
}
