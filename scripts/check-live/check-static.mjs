/**
 * The static part of `check-live`. For each example it builds the live
 * preview with `buildLive()` from the example's own `@describe-me/vitest/live`
 * into a temp directory, under a nested path such as
 * `nested/react-browser/__live/`, and serves the directory as a static host
 * would, which proves the relative base. Against that URL it runs the checks
 * of the dev part: every test of the manifest mounts, with its behaviours,
 * and every page of the status table reports its status. Then the live
 * fixtures of both examples, which the fixture part already ran under
 * Vitest, are built with `LIVE_FIXTURES=1` and held to the same expectation
 * table, so the Node-only test reports `import-failed` with `node:fs`.
 * react-jsdom without `live.setupFiles` must report `setup-failed` for
 * server.node.ts, and with `live: false` `buildLive()` must reject with its
 * code and write nothing. After every build `DESCRIBE_ME_LIVE` is unset and
 * `NODE_ENV` is what it was before.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { exampleNames } from '../docs/example-names.mjs'
import { repoRoot } from '../docs/repo-root.mjs'
import { serveStatic } from '../docs/serve-static.mjs'
import {
  checkFixtureTests,
  checkSetupFailedAt,
  FIXTURE_ENV,
  FIXTURES_DIR,
  LIVE_OFF,
  SETUP_EXAMPLE,
} from './check-fixtures.mjs'
import { checkStatuses, checkTests, STATUSES } from './check-tests.mjs'
import { FIXTURE_EXPECTATIONS } from './fixture-expectations.mjs'
import {
  errorMessage,
  importBuildLive,
  LIVE_ENV,
  manifestTests,
  openHost,
  readManifest,
} from './live-frame.mjs'

function exampleRoot(name) {
  return join(repoRoot, 'examples', name)
}

function moduleIds(manifest) {
  return manifest.modules.map((module) => module.id)
}

/** The files of the status table that exist under the root, such as a test file without a frame. */
function statusFiles(root, name) {
  return (STATUSES[name] ?? [])
    .map((expected) => expected.file)
    .filter((file) => {
      const fromRoot = relative(root, resolve(root, file))
      const inRoot = fromRoot.split(sep)[0] !== '..' && !isAbsolute(fromRoot)

      return inRoot && existsSync(resolve(root, file))
    })
}

/**
 * `buildLive()` of an example into `<tmp>/nested/<dir>/__live/`, with
 * `LIVE_FIXTURES` set only while it runs. Never throws: a rejection comes
 * back as `error`, and the flags left behind as problems.
 */
async function buildInto(site, name, dir, options, fixtures) {
  const root = exampleRoot(name)
  const buildLive = await importBuildLive(root)
  const outDir = join(site.dir, 'nested', dir, '__live')
  const nodeEnv = process.env.NODE_ENV
  const result = { base: `${site.url}nested/${dir}/__live/`, outDir, problems: [] }

  if (fixtures !== undefined) {
    process.env[FIXTURE_ENV] = fixtures
  }

  try {
    result.built = await buildLive({ root, outDir, ...options })
  } catch (error) {
    result.error = error
  } finally {
    delete process.env[FIXTURE_ENV]
  }

  if (process.env[LIVE_ENV] !== undefined) {
    result.problems.push(`${dir}: ${LIVE_ENV} is still set after buildLive()`)
  }

  if (process.env.NODE_ENV !== nodeEnv) {
    result.problems.push(
      `${dir}: NODE_ENV is ${process.env.NODE_ENV} after buildLive(), was ${nodeEnv}`,
    )
  }

  return result
}

/** The problems of a build that must have succeeded with protocol 1. */
function builtProblems(dir, build) {
  if (build.error !== undefined) {
    return [...build.problems, `${dir}: buildLive() rejected: ${errorMessage(build.error)}`]
  }

  if (build.built?.protocol !== 1) {
    return [...build.problems, `${dir}: protocol is ${build.built?.protocol}, expected 1`]
  }

  return build.problems
}

/** Every test of the manifest and every page of the status table, from a static build. */
async function checkExample(browser, host, site, name) {
  const root = exampleRoot(name)
  const manifest = readManifest(root, name)
  const testFiles = [...moduleIds(manifest), ...statusFiles(root, name)]
  const build = await buildInto(site, name, name, { configFile: manifest.configFile, testFiles })
  const problems = builtProblems(name, build)

  if (build.built === undefined) {
    return { problems }
  }

  const context = await openHost(browser, host, name, build.base)

  try {
    const tests = await checkTests(context, manifest)
    const statuses = await checkStatuses(context)

    return {
      problems: [...problems, ...tests.problems, ...statuses.problems],
      summary: `${name} ${tests.mounted}/${manifestTests(manifest).length}`,
      behaviours: tests.behaviours,
      statuses: statuses.passed,
    }
  } finally {
    await context.close()
  }
}

/** The live fixtures of an example, from a build with `LIVE_FIXTURES=1`. */
async function checkExampleFixtures(browser, host, site, name) {
  const manifest = readManifest(exampleRoot(name), name, FIXTURES_DIR)
  const options = { configFile: manifest.configFile, testFiles: moduleIds(manifest) }
  const dir = `${name}-fixtures`
  const build = await buildInto(site, name, dir, options, '1')
  const problems = builtProblems(dir, build)

  if (build.built === undefined) {
    return { problems, passed: 0, behaviours: 0, total: 0 }
  }

  const context = await openHost(browser, host, name, build.base)

  try {
    const result = await checkFixtureTests(context, manifest, FIXTURE_EXPECTATIONS[name])

    return { ...result, problems: [...problems, ...result.problems] }
  } finally {
    await context.close()
  }
}

/** react-jsdom built without `live.setupFiles`: the Node-only setup file reports `setup-failed`. */
async function checkSetupFailed(browser, host, site) {
  const manifest = readManifest(exampleRoot(SETUP_EXAMPLE), SETUP_EXAMPLE, FIXTURES_DIR)
  const options = { configFile: manifest.configFile, testFiles: moduleIds(manifest) }
  const dir = `${SETUP_EXAMPLE}-no-live-setup`
  const build = await buildInto(site, SETUP_EXAMPLE, dir, options, 'no-live-setup')
  const problems = builtProblems(dir, build)

  if (build.built === undefined) {
    return problems
  }

  return [...problems, ...(await checkSetupFailedAt(browser, host, build.base))]
}

/** react-jsdom with `live: false`: `buildLive()` rejects with its code and writes nothing. */
async function checkLiveOff(site) {
  const manifest = readManifest(exampleRoot(SETUP_EXAMPLE), SETUP_EXAMPLE, FIXTURES_DIR)
  const options = { configFile: manifest.configFile, testFiles: moduleIds(manifest) }
  const dir = `${SETUP_EXAMPLE}-off`
  const build = await buildInto(site, SETUP_EXAMPLE, dir, options, 'off')
  const problems = [...build.problems]

  if (build.error === undefined) {
    problems.push(`${dir}: buildLive() finished, expected it to reject with ${LIVE_OFF}`)
  } else if (build.error?.code !== LIVE_OFF) {
    problems.push(
      `${dir}: buildLive() rejected with code ${build.error?.code}, expected ${LIVE_OFF}: ${errorMessage(build.error)}`,
    )
  }

  if (existsSync(build.outDir)) {
    problems.push(`${dir}: buildLive() wrote ${relative(site.dir, build.outDir)}`)
  }

  return problems
}

async function checkAllFixtures(browser, host, site) {
  const result = { problems: [], counts: [], behaviours: 0 }

  for (const name of exampleNames) {
    try {
      const fixtures = await checkExampleFixtures(browser, host, site, name)

      result.problems.push(...fixtures.problems)
      result.counts.push(`${name} ${fixtures.passed}/${fixtures.total}`)
      result.behaviours += fixtures.behaviours
    } catch (error) {
      result.problems.push(`${name} fixtures: ${errorMessage(error)}`)
    }
  }

  for (const check of [() => checkSetupFailed(browser, host, site), () => checkLiveOff(site)]) {
    try {
      result.problems.push(...(await check()))
    } catch (error) {
      result.problems.push(errorMessage(error))
    }
  }

  return result
}

async function checkExamples(browser, host, site) {
  const result = { problems: [], summaries: [], behaviours: 0, statuses: 0 }

  for (const name of exampleNames) {
    try {
      const example = await checkExample(browser, host, site, name)

      result.problems.push(...example.problems)
      result.summaries.push(example.summary ?? `${name} 0`)
      result.behaviours += example.behaviours ?? 0
      result.statuses += example.statuses ?? 0
    } catch (error) {
      result.problems.push(`${name}: ${errorMessage(error)}`)
    }
  }

  return result
}

/** Runs the whole static part, and returns its problems and its part of the summary line. */
export async function checkStatic(browser, host) {
  const dir = mkdtempSync(join(tmpdir(), 'describe-me-check-live-'))
  const { server, url } = await serveStatic(dir)
  const site = { dir, url }

  try {
    const examples = await checkExamples(browser, host, site)
    const fixtures = await checkAllFixtures(browser, host, site)

    return {
      problems: [...examples.problems, ...fixtures.problems].map((problem) => `static ${problem}`),
      summary: `static ${examples.summaries.join(', ')} mounted, ${examples.behaviours} behaviours, ${examples.statuses} statuses, fixtures ${fixtures.counts.join(', ')}, ${fixtures.behaviours} behaviours, setup-failed, live: false`,
    }
  } finally {
    server.closeAllConnections()
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
}
