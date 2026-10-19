let probe: CanvasRenderingContext2D | null = null

function probeContext(): CanvasRenderingContext2D | null {
  if (!probe) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext('2d', { willReadFrequently: true })
  }

  return probe
}

/**
 * The sRGB bytes of a CSS color, alpha last. The canvas parses every syntax
 * the browser knows, `oklch()` and `color()` included. A `fillStyle` it
 * rejects keeps the previous one, so an unknown color reads as transparent.
 */
export function colorBytes(color: string): Uint8ClampedArray | null {
  const context = probeContext()
  if (!context) {
    return null
  }

  context.clearRect(0, 0, 1, 1)
  context.fillStyle = 'transparent'
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)

  return context.getImageData(0, 0, 1, 1).data
}
