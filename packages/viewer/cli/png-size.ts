/** The size of a PNG in pixels, read from its IHDR chunk, which follows the 8-byte signature. */
export function pngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}
