/**
 * Checks the built site/ in headless Chromium, served over HTTP as a host
 * would serve it: docs.css applies to the pages (the light `--bg` token is the
 * body background), and each example viewer loads its data and shows as many
 * tests as its manifest has tests with a frame besides the closing one. Run
 * after `pnpm site:build`.
 *
 * Usage: `node scripts/check-site.mjs`
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleNames } from './docs/example-names.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { serveStatic } from './docs/serve-static.mjs'
import { shownTests } from './docs/shown-tests.mjs'

const SITE = join(repoRoot, 'site')
// --bg of the light :root block in docs/docs.css.
const LIGHT_BACKGROUND = 'rgb(245, 246, 248)'
const VIEWER_TIMEOUT = 20_000

function errorMessage(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error)
}

async function checkPages(context, url) {
  const page = await context.newPage()

  try {
    await page.goto(`${url}index.html`)

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    if (background !== LIGHT_BACKGROUND) {
      return [
        `index.html: the body background is ${background}, not ${LIGHT_BACKGROUND}. Is docs.css served?`,
      ]
    }

    return []
  } finally {
    await page.close()
  }
}

/** The expected test count from the manifest the viewer itself loads. */
function expectedCount(name) {
  const path = join(SITE, 'examples', name, '__data', 'manifest.json')

  if (!existsSync(path)) {
    return null
  }

  return shownTests(JSON.parse(readFileSync(path, 'utf8'))).length
}

async function checkViewer(context, url, name) {
  const expected = expectedCount(name)

  if (expected === null) {
    return [
      `examples/${name}/: site/examples/${name}/__data/manifest.json is missing. Run pnpm site:build`,
    ]
  }

  const page = await context.newPage()
  const failures = []

  page.on('pageerror', (error) => failures.push(errorMessage(error)))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} for ${response.url().slice(url.length)}`)
    }
  })

  try {
    await page.goto(`${url}examples/${name}/`)

    // Without data the header still renders, with 0 tests and "…" as the time of the run.
    const loaded = await page
      .waitForFunction(
        () => {
          const when = document.querySelector('header.header .live .mono')

          return when !== null && when.textContent !== '…'
        },
        undefined,
        { timeout: VIEWER_TIMEOUT },
      )
      .then(() => true)
      .catch(() => false)

    const shown = await page.evaluate(
      () => document.querySelector('header.header .stat b')?.textContent ?? null,
    )

    const detail = failures.length > 0 ? ` (${failures.join(', ')})` : ''

    if (!loaded) {
      return [
        `examples/${name}/: the viewer did not load its data within ${VIEWER_TIMEOUT / 1000} s${detail}`,
      ]
    }

    if (shown !== String(expected)) {
      return [
        `examples/${name}/: the viewer shows ${shown ?? 'no'} tests, the manifest has ${expected}${detail}`,
      ]
    }

    console.log(`check-site: examples/${name}/ shows ${expected} tests`)

    return []
  } finally {
    await page.close()
  }
}

const missing = [
  'index.html',
  ...exampleNames.map((name) => join('examples', name, 'index.html')),
].filter((file) => !existsSync(join(SITE, file)))

if (missing.length > 0) {
  console.error(`check-site: site/ lacks ${missing.join(', ')}. Run pnpm site:build first`)
  process.exit(1)
}

const { server, url } = await serveStatic(SITE)
let browser = null
let problems = []

try {
  browser = await launchChromium()

  const context = await browser.newContext({ colorScheme: 'light' })

  problems.push(...(await checkPages(context, url)))

  for (const name of exampleNames) {
    problems.push(...(await checkViewer(context, url, name)))
  }
} catch (error) {
  problems = [...problems, errorMessage(error)]
} finally {
  await browser?.close()
  server.closeAllConnections()
  server.close()
}

for (const problem of problems) {
  console.error(`check-site: ${problem}`)
}

if (problems.length > 0) {
  process.exit(1)
}

console.log(`check-site: ok — docs.css applies, ${exampleNames.length} viewers load their tests`)
