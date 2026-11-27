import { readFileSync } from 'node:fs'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * The width and height of a PNG file from its IHDR chunk, which follows the
 * 8-byte signature. `undefined` for a file that does not start with the
 * signature and an IHDR.
 */
export function pngSize(file) {
  const bytes = readFileSync(file)

  if (!bytes.subarray(0, 8).equals(SIGNATURE) || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    return undefined
  }

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
