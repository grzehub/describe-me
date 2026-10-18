/** A pair tile, with the paints of its background and foreground. */
export interface ContrastTile {
  tile: HTMLElement
  /** Painted with both, so its computed colors are the frame's. */
  chip: HTMLElement
  /** Where the ratio and the level go. */
  contrast: HTMLElement
  background: string
  foreground: string
}

type Bytes = [number, number, number]

function fill(context: CanvasRenderingContext2D, color: string): Bytes {
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data

  return [red, green, blue]
}

/** WCAG 2 relative luminance of sRGB bytes. */
function luminance([red, green, blue]: Bytes): number {
  const [linearRed = 0, linearGreen = 0, linearBlue = 0] = [red, green, blue].map((byte) => {
    const channel = byte / 255

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
}

function levelOf(ratio: number): string {
  if (ratio >= 7) {
    return 'AAA'
  }

  if (ratio >= 4.5) {
    return 'AA'
  }

  return ratio >= 3 ? 'AA large' : 'fail'
}

/**
 * Write the WCAG 2 contrast of each pair tile for the mode on screen. The
 * canvas converts any CSS color, `oklch()` included, to sRGB bytes, and
 * composites a translucent color over what is under it: the canvas element
 * behind the frame, then the background, then the foreground.
 */
export function showContrast(backdrop: HTMLElement, tiles: ContrastTile[]): void {
  if (tiles.length === 0) {
    return
  }

  const canvas = backdrop.ownerDocument.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return
  }

  const behind = getComputedStyle(backdrop).backgroundColor

  for (const { tile, chip, contrast } of tiles) {
    const style = chip.ownerDocument.defaultView?.getComputedStyle(chip)

    if (!style) {
      continue
    }

    // White first, so a transparent canvas reads as the white under its checkerboard.
    fill(context, '#ffffff')
    fill(context, behind)
    const background = luminance(fill(context, style.backgroundColor))
    const foreground = luminance(fill(context, style.color))
    const ratio =
      (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)

    const level = levelOf(ratio)
    tile.dataset.contrast = ratio.toFixed(2)
    tile.dataset.level = level
    contrast.textContent = `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1 ${level}`
  }
}
