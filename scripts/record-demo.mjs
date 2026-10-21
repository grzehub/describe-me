/**
 * Records a demo of the shadcn viewer for the README and social media: the
 * stage page of scripts/demo/ with the viewer of site/ in it, driven by a
 * scenario, in headless Chromium. Writes <name>.webm, <name>.mp4 and
 * <name>.gif. Needs pnpm site:build first, and ffmpeg on the PATH.
 *
 * Usage: `node scripts/record-demo.mjs [submits|rejects|foundations …] [--out dir]`
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { encodeVideo } from './demo/encode-video.mjs'
import { scenarios } from './demo/scenarios.mjs'
import { StageDriver } from './demo/stage-driver.mjs'
import { launchChromium } from './docs/launch-chromium.mjs'
import { repoRoot } from './docs/repo-root.mjs'
import { serveStatic } from './docs/serve-static.mjs'

const SIZE = { width: 1920, height: 1080 }
const EXAMPLE = 'shadcn'
const SITE = join(repoRoot, 'site')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string', default: join(repoRoot, 'demo') } },
})

const names = positionals.length > 0 ? positionals : Object.keys(scenarios)
const unknown = names.filter((name) => !(name in scenarios))

if (unknown.length > 0) {
  console.error(`record-demo: no scenario named ${unknown.join(', ')}`)
  process.exit(1)
}

if (!existsSync(join(SITE, 'examples', EXAMPLE, '__data', 'manifest.json'))) {
  console.error('record-demo: site/ has no shadcn viewer. Run pnpm site:build first')
  process.exit(1)
}

function testIdOf(fullName) {
  const manifest = JSON.parse(
    readFileSync(join(SITE, 'examples', EXAMPLE, '__data', 'manifest.json'), 'utf8'),
  )

  const test = manifest.modules
    .flatMap((module) => module.tests)
    .find((candidate) => candidate.fullName === fullName)

  if (!test) {
    throw new Error(`the shadcn manifest has no test "${fullName}"`)
  }

  return test.id
}

async function record(browser, url, out, name) {
  const scenario = scenarios[name]
  const context = await browser.newContext({
    viewport: SIZE,
    colorScheme: 'dark',
    recordVideo: { dir: out, size: SIZE },
  })

  // The viewer shares the stage's origin, so its theme is set before it loads.
  await context.addInitScript(() => localStorage.setItem('describe-me:theme', 'dark'))

  const page = await context.newPage()
  const started = Date.now()

  await page.goto(`${url}scripts/demo/stage.html`)

  // live=0 opens on the recorded frames, so the story can reach Live itself. bg=dark darkens
  // the canvas and puts the dark variant on the frames, Live and Foundations.
  const viewerUrl = `${url}site/examples/${EXAMPLE}/#test=${testIdOf(scenario.test)}&live=0&bg=dark`
  await page.evaluate((src) => {
    document.getElementById('viewer').src = src
  }, viewerUrl)

  const stage = new StageDriver(page)
  await stage.viewer
    .locator('.stage-slot[data-frame]:not(.incoming) iframe')
    .waitFor({ state: 'visible', timeout: 20_000 })

  await page.waitForTimeout(800)

  const skipSeconds = (Date.now() - started) / 1000
  await scenario.run(stage)

  const video = page.video()
  await context.close()

  const webm = join(out, `${name}.webm`)
  renameSync(await video.path(), webm)
  encodeVideo(webm, { skipSeconds, mp4: join(out, `${name}.mp4`), gif: join(out, `${name}.gif`) })
  console.log(`record-demo: ${webm}, ${join(out, `${name}.mp4`)}, ${join(out, `${name}.gif`)}`)
}

const out = resolve(values.out)
mkdirSync(out, { recursive: true })

// The repository root, so the stage page and the built site share one origin.
const { server, url } = await serveStatic(repoRoot)
let browser = null

try {
  browser = await launchChromium()

  for (const name of names) {
    await record(browser, url, out, name)
  }
} catch (error) {
  console.error(`record-demo: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.close()
}
