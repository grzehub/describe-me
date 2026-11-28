import type { ShotPage } from './import-playwright.js'

/**
 * Runs in the page, so it carries everything it uses. Draws three panels side
 * by side, each labelled: before, after, and the changed pixels over a dimmed
 * copy of after. Each changed pixel gets a halo, so a change of one pixel
 * still shows when the image is scaled down to the width of a comment.
 */
async function composeImage(images: { before: string; after: string }): Promise<string> {
  const MARGIN = 24
  const GAP = 24
  const LABEL_HEIGHT = 72
  const RADIUS = 6
  const BACKGROUND = '#e8e8e8'
  const CHANGED = [230, 0, 115, 255]
  const HALO = [230, 0, 115, 110]

  async function decode(base64: string): Promise<ImageBitmap> {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()

    return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  }

  function pixelsOf(bitmap: ImageBitmap): Uint32Array {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (context === null) {
      throw new Error('no 2D canvas to draw on')
    }

    context.drawImage(bitmap, 0, 0)

    return new Uint32Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer)
  }

  /** A pixel beyond the shorter or narrower image counts as changed. */
  function changedMask(
    before: ImageBitmap,
    after: ImageBitmap,
    width: number,
    height: number,
  ): Uint8Array {
    const left = pixelsOf(before)
    const right = pixelsOf(after)
    const mask = new Uint8Array(width * height)

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const inBoth =
          column < before.width && row < before.height && column < after.width && row < after.height

        const same =
          inBoth && left[row * before.width + column] === right[row * after.width + column]

        mask[row * width + column] = same ? 0 : 1
      }
    }

    return mask
  }

  /** Every pixel within `RADIUS` of a marked one, along rows, then along columns. */
  function grown(mask: Uint8Array, width: number, height: number): Uint8Array {
    const along = (
      source: Uint8Array,
      lines: number,
      length: number,
      at: (line: number, i: number) => number,
    ) => {
      const result = new Uint8Array(source.length)

      for (let line = 0; line < lines; line++) {
        let count = 0

        for (let i = -RADIUS; i < length; i++) {
          if (i + RADIUS < length && source[at(line, i + RADIUS)] === 1) {
            count++
          }

          if (i - RADIUS - 1 >= 0 && source[at(line, i - RADIUS - 1)] === 1) {
            count--
          }

          if (i >= 0) {
            result[at(line, i)] = count > 0 ? 1 : 0
          }
        }
      }

      return result
    }

    const rows = along(mask, height, width, (row, i) => row * width + i)

    return along(rows, width, height, (column, i) => i * width + column)
  }

  function marksOf(
    mask: Uint8Array,
    halo: Uint8Array,
    width: number,
    height: number,
  ): OffscreenCanvas {
    const marks = new ImageData(width, height)

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        marks.data.set(CHANGED, i * 4)
      } else if (halo[i] === 1) {
        marks.data.set(HALO, i * 4)
      }
    }

    const layer = new OffscreenCanvas(width, height)
    layer.getContext('2d')?.putImageData(marks, 0, 0)

    return layer
  }

  const [before, after] = await Promise.all([decode(images.before), decode(images.after)])
  const width = Math.max(before.width, after.width)
  const height = Math.max(before.height, after.height)
  const mask = changedMask(before, after, width, height)
  const marks = marksOf(mask, grown(mask, width, height), width, height)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (context === null) {
    throw new Error('no 2D canvas to draw on')
  }

  canvas.width = MARGIN * 2 + width * 3 + GAP * 2
  canvas.height = MARGIN * 2 + LABEL_HEIGHT + height

  const top = MARGIN + LABEL_HEIGHT
  const lefts = [0, 1, 2].map((panel) => MARGIN + panel * (width + GAP))

  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#333333'
  context.font = '600 40px system-ui, sans-serif'
  context.textBaseline = 'middle'

  for (const [panel, label] of ['Before', 'After', 'Changed pixels'].entries()) {
    context.fillText(label, lefts[panel], MARGIN + LABEL_HEIGHT / 2)
  }

  context.drawImage(before, lefts[0], top)
  context.drawImage(after, lefts[1], top)
  context.drawImage(after, lefts[2], top)
  context.fillStyle = 'rgba(255, 255, 255, 0.75)'
  context.fillRect(lefts[2], top, after.width, after.height)
  context.drawImage(marks, lefts[2], top)

  return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length)
}

/**
 * The image of a pair that looks different, as PNG bytes: before, after and
 * the changed pixels, side by side, drawn in `page`.
 */
export async function composeShot(page: ShotPage, before: Buffer, after: Buffer): Promise<Buffer> {
  const base64 = await page.evaluate(composeImage, {
    before: before.toString('base64'),
    after: after.toString('base64'),
  })

  return Buffer.from(base64, 'base64')
}
