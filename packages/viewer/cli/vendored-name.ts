import { createHash } from 'node:crypto'

/** The name a vendored file gets in `assets/`: the sha1-16 of its bytes plus its extension. */
export function vendoredName(bytes: Uint8Array, extension: string): string {
  return `${createHash('sha1').update(bytes).digest('hex').slice(0, 16)}${extension}`
}
