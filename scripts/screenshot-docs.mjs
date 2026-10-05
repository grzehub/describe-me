/**
 * Takes full-page screenshots of docs pages in headless Chromium, at desktop
 * (1280×900) and phone (390×844) size, in the light and the dark colour
 * scheme, so a writer can look at a page without a browser of their own.
 * Serves site/ when it is built, else docs/. Exits 1 when a page is wider
 * than the phone viewport, which means something does not wrap or scroll.
 *
 * Usage: `node scripts/screenshot-docs.mjs [page.html …] [--out dir]`
 */
import { existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { launchChromium } from './docs/launch-chromium.mjs'
import { pages } from './docs/pages.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { serveStatic } from './docs/serve-static.mjs'

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]

const PHONE_WIDTH = 390
const SCHEMES = ['light', 'dark']

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string', default: join(tmpdir(), 'describe-me-docs-screenshots') } },
})

const requested = positionals.map((page) => basename(page))
const files = requested.length > 0 ? requested : pages.map((page) => page.file)
const unknown = files.filter((file) => !pages.some((page) => page.file === file))

if (unknown.length > 0) {
  console.error(`docs:screenshots: not a page of scripts/docs/pages.mjs: ${unknown.join(', ')}`)
  process.exit(1)
}

const built = existsSync(join(repoRoot, 'site', 'index.html'))
const served = join(repoRoot, built ? 'site' : 'docs')
const out = resolve(values.out)

mkdirSync(out, { recursive: true })

const { server, url } = await serveStatic(served)
const overflowing = new Set()
let browser = null

try {
  browser = await launchChromium()
  console.log(`docs:screenshots: ${built ? 'site/' : 'docs/'} at ${url}`)

  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport, colorScheme: scheme })
      const page = await context.newPage()

      for (const file of files) {
        await page.goto(`${url}${file}`)

        const path = join(out, `${basename(file, '.html')}-${viewport.width}-${scheme}.png`)
        await page.screenshot({ path, fullPage: true })
        console.log(path)

        const width = await page.evaluate(() => document.documentElement.scrollWidth)

        if (viewport.width === PHONE_WIDTH && width > viewport.width) {
          overflowing.add(`${file} (${width} px wide)`)
        }
      }

      await context.close()
    }
  }
} catch (error) {
  console.error(`docs:screenshots: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.closeAllConnections()
  server.close()
}

if (overflowing.size > 0) {
  console.error(
    `docs:screenshots: wider than ${PHONE_WIDTH} px, so a phone scrolls sideways: ${[...overflowing].join(', ')}`,
  )

  process.exitCode = 1
}
