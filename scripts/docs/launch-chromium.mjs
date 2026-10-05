import { loadPlaywright } from './load-playwright.mjs'

/** A headless Chromium from Playwright, with the install command in the error when it is missing. */
export async function launchChromium() {
  const { chromium } = loadPlaywright()

  try {
    return await chromium.launch()
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)

    throw new Error(
      `cannot start Chromium (${reason}). Run pnpm --filter react-browser exec playwright install chromium.`,
    )
  }
}
