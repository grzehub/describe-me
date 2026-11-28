import type { DataDir } from './data-dir.js'

/** What `frame.html` shows, read from its query. */
export interface FrameParams {
  /** The data directory that holds the snapshot. */
  data: DataDir
  /** The snapshot's path in that directory. */
  snapshot: string
  /** The frame's width in CSS pixels. */
  width: number
}

const WHOLE_NUMBER = /^[1-9][0-9]*$/

function dataDirOf(value: string | null): DataDir {
  if (value === null || value === '__data') {
    return '__data'
  }

  if (value === '__base') {
    return '__base'
  }

  throw new Error(`data must be __data or __base, got "${value}"`)
}

/**
 * Read `?data=__data|__base&snapshot=<path>&width=<CSS px>`, where `data`
 * defaults to `__data`. Throws on a missing snapshot, another data directory
 * or a width that is not a positive whole number.
 */
export function frameParams(search: string): FrameParams {
  const params = new URLSearchParams(search)
  const snapshot = params.get('snapshot')
  const width = params.get('width') ?? ''

  if (!snapshot) {
    throw new Error('frame.html needs ?snapshot=<path in the data directory>')
  }

  if (!WHOLE_NUMBER.test(width)) {
    throw new Error(`width must be a positive whole number of CSS pixels, got "${width}"`)
  }

  return { data: dataDirOf(params.get('data')), snapshot, width: Number(width) }
}
