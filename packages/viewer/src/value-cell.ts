import { h } from './h.js'

/** Render one serialized prop value, coloured by its type. */
export function valueCell(v: unknown): HTMLElement {
  if (typeof v === 'string') {
    if (v.startsWith('ƒ ')) return h('span', { class: 'val-fn' }, v)
    return h('span', { class: 'val-string' }, JSON.stringify(v))
  }
  if (typeof v === 'number' || typeof v === 'boolean')
    return h('span', { class: `val-${typeof v}` }, String(v))
  if (v === null || v === undefined) return h('span', { class: 'val-fn' }, String(v))
  return h('span', {}, JSON.stringify(v))
}
