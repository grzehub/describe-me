import type { ShotPage } from './import-playwright.js'

/** How long a frame may take to report how it rendered. */
const STATUS_TIMEOUT_MS = 30_000

/** What `frame.html` reports on `<html>`. */
export interface FrameReport {
  status?: string
  height?: string
  error?: string
  missing?: string
}

function readReport(): FrameReport {
  return { ...document.documentElement.dataset }
}

/**
 * Open a URL of `frame.html` in `page` and wait up to 30 s until the page
 * reports how the frame rendered. Throws on a timeout or a failed navigation.
 */
export async function waitForFrame(page: ShotPage, url: string): Promise<FrameReport> {
  await page.goto(url, { waitUntil: 'commit', timeout: STATUS_TIMEOUT_MS })
  await page.waitForFunction('document.documentElement.dataset.status !== undefined', undefined, {
    timeout: STATUS_TIMEOUT_MS,
  })

  return page.evaluate(readReport, undefined)
}
