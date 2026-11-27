import { createHash } from 'node:crypto'

/** Every id the reporter writes matches, and no such name leaves `--out` or breaks a Markdown link. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * The file name of a test's image in `--out`: `<id>.png`, or the first 12 hex
 * characters of the id's SHA-1 when the id is not a safe file name, so a
 * manifest can never steer a path.
 */
export function shotFileName(id: string): string {
  const name = SAFE_ID.test(id) ? id : createHash('sha1').update(id).digest('hex').slice(0, 12)

  return `${name}.png`
}
