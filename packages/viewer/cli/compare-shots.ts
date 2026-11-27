import type { Look } from './changes-report.js'
import type { ShotPage } from './import-playwright.js'
import { pngSize } from './png-size.js'

/**
 * Runs in the page, so it carries everything it uses. Decoded without colour
 * conversion, so two different pixels never decode alike.
 */
async function samePixels(images: { before: string; after: string }): Promise<boolean> {
  async function pixels(base64: string): Promise<Uint32Array> {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
    const bitmap = await createImageBitmap(blob, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (context === null) {
      throw new Error('no 2D canvas to compare on')
    }

    context.drawImage(bitmap, 0, 0)

    return new Uint32Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer)
  }

  const [before, after] = await Promise.all([pixels(images.before), pixels(images.after)])

  if (before.length !== after.length) {
    return false
  }

  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) {
      return false
    }
  }

  return true
}

/**
 * Whether two screenshots of a pair look the same, every pixel exactly, with
 * no threshold. Equal bytes are equal pixels, and images of different sizes
 * differ. Anything else is decoded and compared in `page`.
 */
export async function compareShots(page: ShotPage, before: Buffer, after: Buffer): Promise<Look> {
  if (before.equals(after)) {
    return 'same'
  }

  const left = pngSize(before)
  const right = pngSize(after)

  if (left.width !== right.width || left.height !== right.height) {
    return 'different'
  }

  const same = await page.evaluate(samePixels, {
    before: before.toString('base64'),
    after: after.toString('base64'),
  })

  return same ? 'same' : 'different'
}
