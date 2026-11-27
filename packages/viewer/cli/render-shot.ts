import type { ShotContext } from './import-playwright.js'
import { reasonOf } from './reason-of.js'
import type { FrameReport } from './wait-for-frame.js'
import { waitForFrame } from './wait-for-frame.js'

/** A frame to render: the run it is from and its snapshot there. */
export interface ShotSide {
  side: 'base' | 'head'
  /** `ManifestFrame.snapshot`, relative to that run's directory. */
  snapshot: string
}

function frameUrl(origin: string, shot: ShotSide, width: number): string {
  const url = new URL('/frame.html', origin)
  url.searchParams.set('data', shot.side === 'base' ? '__base' : '__data')
  url.searchParams.set('snapshot', shot.snapshot)
  url.searchParams.set('width', String(width))

  return url.href
}

function warn(shot: ShotSide, text: string): void {
  process.stderr.write(`describe-me: frame ${shot.side} ${shot.snapshot} ${text}\n`)
}

function heightOf(report: FrameReport): number {
  const height = Number(report.height)

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`the frame reported the height ${String(report.height)}`)
  }

  return height
}

async function screenshot(
  context: ShotContext,
  origin: string,
  shot: ShotSide,
  width: number,
): Promise<Buffer | undefined> {
  const page = await context.newPage()

  try {
    const report = await waitForFrame(page, frameUrl(origin, shot, width))

    if (report.status !== 'ready') {
      warn(shot, `did not render (${report.error ?? 'no reason given'})`)
      return undefined
    }

    const height = heightOf(report)
    await page.setViewportSize({ width, height })

    const png = await page.screenshot({
      clip: { x: 0, y: 0, width, height },
      animations: 'disabled',
      caret: 'hide',
    })

    if (report.missing !== undefined) {
      warn(shot, `rendered without ${report.missing}, so its pair may differ for that alone`)
    }

    return png
  } finally {
    await page.close().catch(() => undefined)
  }
}

/**
 * Render one frame through the viewer's `frame.html` and take a screenshot of
 * exactly the frame, in device pixels. A frame that does not render, times
 * out or fails to load gives `undefined` and a warning on stderr, never an
 * error.
 */
export async function renderShot(
  context: ShotContext,
  origin: string,
  shot: ShotSide,
  width: number,
): Promise<Buffer | undefined> {
  try {
    return await screenshot(context, origin, shot, width)
  } catch (error) {
    warn(shot, `did not render (${reasonOf(error).split('\n')[0]})`)
    return undefined
  }
}
