import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LIVE_PROTOCOL, type Manifest } from '@describe-me/core/types'
import { codeOf } from './code-of.js'
import { importBuildLive } from './import-build-live.js'
import { LIVE_CONSEQUENCES } from './live-consequences.js'
import type { LivePreviewInfo } from './live-preview-info.js'
import { liveProject, type LiveProject } from './live-project.js'
import { reasonOf } from './reason-of.js'

const STOPPED = LIVE_CONSEQUENCES.build
// The code `buildLive()` rejects with when the project's config sets `live: false`.
const LIVE_OFF = 'DESCRIBE_ME_LIVE_OFF'
const READY: LivePreviewInfo = { status: 'ready', base: '__live/' }

/** The module ids of the manifest. Even with `--root` the build needs them, as its list of tests. */
function manifestTestFiles(data: string): string[] {
  const file = join(resolve(data), 'manifest.json')

  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing, ${STOPPED}. Run the tests first, because the manifest lists the tests to build.`,
    )
  }

  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as Pick<Manifest, 'modules'>

    return manifest.modules.map((module) => module.id)
  } catch (error) {
    throw new Error(`cannot read ${file} (${reasonOf(error)}), ${STOPPED}.`)
  }
}

/** The reason for an error of `buildLive()`, which knows nothing of the CLI. */
function buildFailure(error: unknown): Error {
  if (codeOf(error) === LIVE_OFF) {
    return new Error(
      `${reasonOf(error)}, but --live asks for it, ${STOPPED}. Remove one of the two.`,
    )
  }

  return new Error(`the live build failed: ${reasonOf(error)}`)
}

async function buildProject(
  project: LiveProject,
  outDir: string,
  testFiles: string[],
): Promise<void> {
  const buildLive = await importBuildLive(project.root)
  const built = await buildLive({ ...project, outDir, testFiles }).catch((error: unknown) => {
    throw buildFailure(error)
  })

  if (built.protocol !== LIVE_PROTOCOL) {
    throw new Error(
      `all describe-me packages must be on the same version. The live build in ${project.root} speaks protocol ${built.protocol}, this viewer ${LIVE_PROTOCOL}, ${STOPPED}.`,
    )
  }
}

/**
 * Builds the live preview of the manifest's tests into `<out>/__live/` and
 * writes `__live.json` next to the viewer, so the static site shows Live.
 * On failure it leaves neither behind and throws the reason.
 */
export async function buildLivePreview(
  data: string,
  out: string,
  root: string | undefined,
): Promise<void> {
  const outDir = join(resolve(out), '__live')
  let testFiles: string[]

  try {
    testFiles = manifestTestFiles(data)
    await buildProject(liveProject(data, root, STOPPED), outDir, testFiles)
  } catch (error) {
    rmSync(outDir, { recursive: true, force: true })

    throw new Error(reasonOf(error), { cause: error })
  }

  const files = testFiles.length === 1 ? '1 test file' : `${testFiles.length} test files`

  writeFileSync(join(resolve(out), '__live.json'), JSON.stringify(READY))
  process.stdout.write(`  ➜  Live preview: ${join(out, '__live')}/ (${files})\n`)
}
