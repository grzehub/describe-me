/**
 * Spike: one image per changed test, with the first changed frame before and
 * after. Both frames are replayed from their stored snapshots by the static
 * viewer, in the same Chromium, so no test runs again and nothing is hosted.
 *
 * `baseSite` and `headSite` are `describe-me build` outputs of the two
 * directories that `changed-frames.mjs` compared, and `changed.json` is what
 * it printed.
 *
 * Usage: `node spike/pr-attach/shoot-frames.mjs <baseSite> <headSite> <changed.json> <outDir> [limit]`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChromium } from '../../scripts/docs/launch-chromium.mjs'
import { serveStatic } from '../../scripts/docs/serve-static.mjs'

/** The width of the replayed page, in CSS pixels. */
const FRAME_WIDTH = 480

/** Long enough for the viewer to swap the frame in once its styles and fonts are there. */
const SETTLE_MS = 1000

const SHEET_STYLE = `
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; color: #1f2328; background: #fff; }
  #sheet { display: inline-block; padding: 16px; }
  h1 { margin: 0; font-size: 15px; }
  p { margin: 2px 0 12px; color: #59636e; }
  .pair { display: flex; gap: 16px; }
  figure { margin: 0; }
  figcaption { margin-bottom: 6px; font-weight: 600; }
  img { display: block; width: ${FRAME_WIDTH}px; border: 1px solid #d1d9e0; }
`

const [baseSite, headSite, changedFile, outDir, limit = '6'] = process.argv.slice(2)

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** The viewer's link to a recorded frame. Frame 0 needs `live=0`, any other frame its number. */
function frameLink(testId, index) {
  const frame = index === 0 ? 'live=0' : `frame=${index}`

  return `#test=${testId}&${frame}&w=${FRAME_WIDTH}`
}

async function shoot(page, siteUrl, testId, index) {
  // A change of the hash alone would not load the viewer again.
  await page.goto('about:blank')
  await page.goto(`${siteUrl}${frameLink(testId, index)}`)

  const frame = page.locator('.stage-slot:not(.incoming) iframe').first()
  await frame.waitFor()
  await page.waitForTimeout(SETTLE_MS)

  return frame.screenshot()
}

function figure(caption, png) {
  const source = `data:image/png;base64,${png.toString('base64')}`

  return `<figure><figcaption>${caption}</figcaption><img src="${source}" alt="" /></figure>`
}

async function compose(page, test, frame, before, after) {
  await page.setContent(`<!doctype html>
    <style>${SHEET_STYLE}</style>
    <main id="sheet">
      <h1>${escapeHtml(test.fullName)}</h1>
      <p>${escapeHtml(test.module)} · frame ${frame.index} · ${escapeHtml(frame.label)}</p>
      <div class="pair">${figure('Before', before)}${figure('After', after)}</div>
    </main>`)

  return page.locator('#sheet').screenshot()
}

const changed = JSON.parse(readFileSync(changedFile, 'utf8')).slice(0, Number(limit))
const base = await serveStatic(baseSite)
const head = await serveStatic(headSite)
const browser = await launchChromium()

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  })

  mkdirSync(outDir, { recursive: true })

  for (const test of changed) {
    const [frame] = test.frames
    const before = await shoot(page, base.url, test.id, frame.index)
    const after = await shoot(page, head.url, test.id, frame.index)
    const file = join(outDir, `${test.id}.png`)

    writeFileSync(file, await compose(page, test, frame, before, after))
    console.log(`${file}  ${test.fullName}`)
  }
} finally {
  await browser.close()
  base.server.close()
  head.server.close()
}
