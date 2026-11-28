import type { ShotBrowser, ShotBrowserType } from './import-playwright.js'
import { reasonOf } from './reason-of.js'

/** A headless Chromium for `--shots`. Throws with the install command when it cannot start. */
export async function launchChromium(chromium: ShotBrowserType): Promise<ShotBrowser> {
  try {
    return await chromium.launch()
  } catch (error) {
    const reason = reasonOf(error).split('\n')[0]

    throw new Error(
      `cannot start Chromium for --shots (${reason}). Run npx playwright install chromium in the project.`,
    )
  }
}
