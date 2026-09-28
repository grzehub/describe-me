/** File signatures of the font formats a browser loads, read from the first four bytes. */
const SIGNATURES: [number[], string][] = [
  [[0x77, 0x4f, 0x46, 0x32], '.woff2'],
  [[0x77, 0x4f, 0x46, 0x46], '.woff'],
  [[0x4f, 0x54, 0x54, 0x4f], '.otf'],
  [[0x00, 0x01, 0x00, 0x00], '.ttf'],
  [[0x74, 0x72, 0x75, 0x65], '.ttf'],
]

/** The extension of a font file from its magic bytes, or null when the bytes are not a font. */
export function fontExtension(bytes: Uint8Array): string | null {
  const match = SIGNATURES.find(([signature]) => {
    return signature.every((byte, i) => bytes[i] === byte)
  })

  return match === undefined ? null : match[1]
}
