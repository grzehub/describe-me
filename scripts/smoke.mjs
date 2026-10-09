/**
 * Verifies the published artifact, not the sources: packs every package,
 * installs the tarballs into a fresh project outside the monorepo, runs the
 * same component through the plugin in browser mode and in jsdom, and builds
 * the static site. Right after the install it downloads the browser of the
 * project's own Playwright, because a fresh install can resolve a newer
 * Playwright than the lockfile's, and CI installs only the lockfile's browser.
 * Then it checks the plugin's reporters in child processes that see only
 * each case's variables: without a list of the config's own, describe-me's
 * reporter joins the ones the installed Vitest picks for an AI agent and for
 * GitHub Actions. Then it checks that exactly
 * one Vite version landed in the project: `describe-me` peers on the host's
 * Vite instead of nesting its own. In both environments one test file is excluded
 * and one renders nothing: each asserts `recorder.isActive` inside the test,
 * which proves that the plugin's options reach the test runtime, and neither
 * may appear in the manifest.
 * The DOM scenario also checks the Testing Library adapter: `fireEvent` under
 * a file-level `afterEach(cleanup)` records exactly its render and click
 * frames, a `renderHook` file is unmounted after each test and stays out of
 * the manifest, and a test file under `packages/react/` is still redirected.
 * Its `previewHead` must reach the manifest. The reporter that writes it
 * imports `@describe-me/core/css-references`, so the packed core must export it.
 * The DOM scenario also runs a leak pair: a test that ends with a keyboard
 * action and a `step()` it did not await, then a test that must record exactly
 * its own render and click frames.
 * Four more runs check `renderFrame` on a component that shows a loader for
 * 50 ms: in jsdom `'lazy'`, `{ pending }` and a `pending` selector jsdom
 * rejects, in browser mode `'lazy'`. Each test must record exactly the
 * expected frames, and every render frame must show the loaded component,
 * never the loader. In the pending run one test asserts that the observer
 * took the frame before `recorder.flush()` could. The rejected selector must
 * pass with one warning, for its one test file, and record the lazy run's
 * frames.
 * A jsdom run with `include: []` has two test files that must not record. The
 * reporter must warn once, not once per file, and write a manifest with no
 * module and no setup warning.
 * A jsdom run renders a styled component with styled-components 6.3, whose
 * browser build imports tslib. Its one test must pass and record exactly its
 * render frame, which must carry both the global style and the component's
 * colour. The manifest must hold no setup warning. The project installs
 * styled-components, so every jsdom run uses its browser build.
 * The static site is built twice. The default build vendors fonts, which
 * proves that the packed CLI loads the vendoring code and its
 * `@describe-me/core` imports. The browser data links no remote font, so its
 * copied manifest must stay byte for byte. The DOM data is built with
 * `--no-vendor-fonts`, and its head must still link Google Fonts. Neither
 * build touches the network.
 * The version guard is checked three ways: the packed packages peer on each
 * other at this release, both manifests name `@describe-me/vitest` and its
 * version as their `generator`, and a jsdom run whose setup file plants a
 * 0.4-shaped recorder must fail with "must be on the same version", never with
 * "is not a function".
 * After the single-Vite check, exactly one React version must be installed,
 * the one `--react` names when given.
 * Two naming runs, in jsdom and in browser mode, render two registered
 * components the way both examples' `names …` tests do: inside providers, a
 * test-local memo, a fragment, Suspense, a wrapper and after a rerender. Each
 * test must document the component its name says, from that component's file,
 * with the props its name lists.
 * A second project installs without `@testing-library/user-event`, an
 * optional peer. No copy of it may be installed there, and its `fireEvent`
 * test must pass and record exactly its render and click frames. It runs
 * last, so a failure there never hides one in the main project.
 * Usage: `pnpm smoke [--keep] [--vite <x.y.z>] [--vitest <x.y.z>] [--react <x.y.z>]`
 * (keep leaves the temp projects for inspection; `--vite`, `--vitest` and
 * `--react` pin older versions of the user's toolchain).
 */
import { execFileSync, execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * Vite 8's native bindings (rolldown) declare `engines` and package managers
 * silently skip optional dependencies that do not match, so on an older Node
 * the fresh project would fail with "Cannot find native binding".
 */
const REQUIRED_NODE = '^20.19.0 || >=22.12.0'

function assertNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22

  if (!supported) {
    throw new Error(`smoke: needs Node ${REQUIRED_NODE}, running ${process.version}`)
  }
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/

/** The raw flags; unknown flags and positionals are rejected with a `smoke:` error. */
function readFlags() {
  try {
    const { values } = parseArgs({
      strict: true,
      allowPositionals: false,
      options: {
        keep: { type: 'boolean', default: false },
        vite: { type: 'string' },
        vitest: { type: 'string' },
        react: { type: 'string' },
      },
    })

    return values
  } catch (error) {
    throw new Error(`smoke: ${error.message}`)
  }
}

/**
 * Reads the command line strictly, so a typo fails here, before anything is
 * packed or a temp directory is created.
 */
function parseOptions() {
  const values = readFlags()

  for (const name of ['vite', 'vitest', 'react']) {
    const version = values[name]

    if (version !== undefined && !EXACT_VERSION.test(version)) {
      throw new Error(`smoke: --${name} expects an exact version like 6.4.3, got "${version}"`)
    }
  }

  return { keep: values.keep, vite: values.vite, vitest: values.vitest, reactVersion: values.react }
}

const { keep, vite, vitest, reactVersion } = parseOptions()
const work = mkdtempSync(join(tmpdir(), 'describe-me-smoke-'))
const tarballs = join(work, 'tarballs')
const app = join(work, 'app')
const withoutUserEvent = join(work, 'app-without-user-event')

/** Run a command in the given directory; `quiet` swallows its output unless it fails. */
function run(command, cwd, quiet = false, env = {}) {
  console.log(`\n$ ${command}  (${cwd.replace(work, '<tmp>')})`)
  execSync(command, {
    cwd,
    stdio: quiet ? 'pipe' : 'inherit',
    env: { ...process.env, CI: '1', ...env },
  })
}

/**
 * The browser build of the project's own Playwright. A fresh install can
 * resolve a newer Playwright than the lockfile's, and CI installs only the
 * lockfile's browser. Without Playwright's clean-up the install never removes
 * a browser that another checkout on this machine still uses.
 */
function installBrowser(project) {
  run('pnpm exec playwright install chromium', project, false, { PLAYWRIGHT_SKIP_BROWSER_GC: '1' })
}

/** Run a command that must fail, and return what it printed on stdout and stderr. */
function runFailing(command, cwd) {
  console.log(`\n$ ${command}  (${cwd.replace(work, '<tmp>')}, expected to fail)`)

  try {
    execSync(command, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '1' } })
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    console.log(output)

    return output
  }

  throw new Error(`smoke: expected ${command} to fail`)
}

/** Run a command that must pass, and return what it printed on stdout and stderr. */
function runPassing(command, cwd) {
  console.log(`\n$ ${command}  (${cwd.replace(work, '<tmp>')})`)

  const output = execSync(`${command} 2>&1`, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  })

  console.log(output)

  return output
}

/** `@scope/name@1.2.3` packs to `scope-name-1.2.3.tgz`, exactly as pnpm names it. */
function tarballName(manifest) {
  return `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const packageDirs = ['core', 'react', 'vitest', 'viewer'].map((dir) => join(root, 'packages', dir))
const manifests = packageDirs.map((dir) => readJson(join(dir, 'package.json')))
const example = readJson(join(root, 'examples', 'react-browser', 'package.json'))
const domExample = readJson(join(root, 'examples', 'react-jsdom', 'package.json'))
const rootManifest = readJson(join(root, 'package.json'))

/** The version a packed package carries, which pnpm pack writes into `workspace:^` ranges. */
function versionOf(name) {
  return manifests.find((manifest) => manifest.name === name).version
}

/** The user's toolchain, pinned to what the example and the repo run on, so there is one source of truth. */
function toolchain(names) {
  const versions = {
    ...rootManifest.devDependencies,
    ...example.dependencies,
    ...example.devDependencies,
    ...domExample.dependencies,
    ...domExample.devDependencies,
  }

  const picked = {}

  for (const name of names) {
    if (!versions[name]) {
      throw new Error(`smoke: ${name} is not a dependency of the example project`)
    }

    picked[name] = versions[name]
  }

  return picked
}

/**
 * 6.3 is the last minor whose browser build imports tslib, which the plugin
 * has to alias. The examples resolve a later one, so `toolchain()` cannot pick it.
 */
const STYLED_COMPONENTS = '6.3.12'

function pack() {
  mkdirSync(tarballs, { recursive: true })

  for (const dir of packageDirs) {
    run(`pnpm pack --pack-destination ${tarballs}`, dir, true)
  }

  for (const manifest of manifests) {
    const file = join(tarballs, tarballName(manifest))

    if (!existsSync(file)) {
      throw new Error(`smoke: expected tarball ${file}`)
    }
  }
}

/**
 * The versions the command line pins, by package name. The playwright provider
 * peers the exact matching Vitest, so `--vitest` moves both.
 */
function commandLinePins() {
  const typesRange = reactVersion ? `^${reactVersion.split('.')[0]}` : undefined

  return {
    vite,
    vitest,
    '@vitest/browser-playwright': vitest,
    react: reactVersion,
    'react-dom': reactVersion,
    '@types/react': typesRange,
    '@types/react-dom': typesRange,
  }
}

/** The toolchain for `names`, with the command-line pins applied to those names only. */
function pinnedToolchain(names) {
  const picked = toolchain(names)
  const pins = commandLinePins()

  for (const name of names) {
    if (pins[name]) {
      picked[name] = pins[name]
    }
  }

  return picked
}

/**
 * Every package points at its tarball, and the overrides make pnpm resolve
 * the packages' own `@describe-me/core` dependency to the tarball too,
 * instead of asking the registry for a version that is not published yet.
 * Vite is deliberately not overridden: the single-Vite check has to prove
 * that the peer lets pnpm reuse the project's own Vite.
 */
function writePackageJson(project, name, devDependencies) {
  const local = Object.fromEntries(
    manifests.map((manifest) => [manifest.name, `file:${join(tarballs, tarballName(manifest))}`]),
  )

  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        devDependencies: { ...local, ...devDependencies },
        pnpm: { overrides: local },
      },
      null,
      2,
    ),
  )
}

function writeTsconfig(project, types) {
  writeFileSync(
    join(project, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          ...(types ? { types } : {}),
        },
        include: ['src', 'vitest.config.ts'],
      },
      null,
      2,
    ),
  )
}

const HELLO_SOURCE = `import { useState } from 'react'

export interface HelloProps {
  /** Who to greet. */
  name: string
  tone?: 'plain' | 'loud'
}

export function Hello({ name, tone = 'plain' }: HelloProps) {
  const [count, setCount] = useState(0)
  const text = tone === 'loud' ? \`HELLO \${name.toUpperCase()}\` : \`Hello \${name}\`

  return (
    <div>
      <p>{text}</p>
      <button type="button" onClick={() => setCount((current) => current + 1)}>
        waved {count} times
      </button>
    </div>
  )
}
`

const FIRE_EVENT_TEST = `import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Hello } from '../src/Hello'

afterEach(cleanup)

describe('FireEvent', () => {
  it('counts a fired click', () => {
    render(<Hello name="Ada" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('waved 1 times')
  })
})
`

function scaffold() {
  mkdirSync(join(app, 'src'), { recursive: true })

  writePackageJson(app, 'describe-me-smoke', {
    ...pinnedToolchain([
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
      'vitest',
      '@vitest/browser-playwright',
      'vitest-browser-react',
      '@vitejs/plugin-react',
      'playwright',
      'typescript',
      '@testing-library/react',
      '@testing-library/dom',
      '@testing-library/user-event',
      'jsdom',
      'vite',
    ]),
    'styled-components': STYLED_COMPONENTS,
  })

  writeTsconfig(app, ['vitest/browser'])

  writeFileSync(
    join(app, 'vitest.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ exclude: ['src/Excluded.test.tsx'] })],
  test: {
    include: ['src/**/*.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
`,
  )

  // The DOM scenario: same component, Testing Library tests, jsdom, and its
  // own output directory so the two manifests can be checked separately.
  writeFileSync(
    join(app, 'vitest.dom.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [
    react(),
    describeMe({
      outDir: '.describe-me-dom',
      exclude: ['dom/Excluded.test.tsx'],
      previewHead:
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap">',
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['dom/**/*.test.tsx'],
  },
})
`,
  )

  mkdirSync(join(app, 'dom', 'packages', 'react'), { recursive: true })

  writeFileSync(
    join(app, 'dom', 'Hello.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Hello } from '../src/Hello'

describe('Hello', () => {
  it('greets and counts waves', async () => {
    const screen = render(<Hello name="Ada" />)
    expect(screen.getByText('Hello Ada')).toBeDefined()
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('waved 1 times')
  })

  it('can be loud', () => {
    const screen = render(<Hello name="Ada" tone="loud" />)
    expect(screen.getByText('HELLO ADA')).toBeDefined()
  })
})
`,
  )

  writeFileSync(
    join(app, 'dom', 'pure.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { recorder } from '@describe-me/vitest'

describe('pure', () => {
  it('records in an included file', () => {
    expect(recorder.isActive).toBe(true)
  })
})
`,
  )

  writeFileSync(join(app, 'dom', 'FireEvent.test.tsx'), FIRE_EVENT_TEST)

  writeFileSync(
    join(app, 'dom', 'Leak.test.tsx'),
    `import { describe, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { step } from '@describe-me/vitest'
import { Hello } from '../src/Hello'

describe('Leak', () => {
  it('ends with work it did not await', () => {
    const user = userEvent.setup({ delay: 50 })
    render(<Hello name="Ada" />)
    void user.keyboard('a')
    void step('late', () => new Promise((resolve) => setTimeout(resolve, 50)))
  })

  it('records only its own frames', async () => {
    render(<Hello name="Bea" />)
    await userEvent.setup().click(screen.getByRole('button'))
    await new Promise((resolve) => setTimeout(resolve, 200))
  })
})
`,
  )

  writeFileSync(
    join(app, 'dom', 'hook.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'

describe('hook', () => {
  it('updates its state', () => {
    const { result } = renderHook(() => useState(false))
    act(() => {
      result.current[1](true)
    })
    expect(result.current[0]).toBe(true)
  })

  it('is unmounted after each test', () => {
    expect(document.body.childElementCount).toBe(0)
  })
})
`,
  )

  // A path containing `/packages/react/` must still count as a user test file.
  writeFileSync(
    join(app, 'dom', 'packages', 'react', 'Monorepo.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Hello } from '../../../src/Hello'

describe('Monorepo', () => {
  it('records under a packages/react directory', () => {
    const screen = render(<Hello name="Ada" />)
    expect(screen.getByText('Hello Ada')).toBeDefined()
  })
})
`,
  )

  writeFileSync(
    join(app, 'dom', 'Excluded.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { recorder } from '@describe-me/vitest'
import { Hello } from '../src/Hello'

describe('Excluded', () => {
  it('renders without recording', () => {
    const screen = render(<Hello name="Ada" />)
    expect(screen.getByText('Hello Ada')).toBeDefined()
    expect(recorder.isActive).toBe(false)
  })
})
`,
  )

  writeFileSync(join(app, 'src', 'Hello.tsx'), HELLO_SOURCE)

  writeFileSync(
    join(app, 'src', 'Hello.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Hello } from './Hello'

describe('Hello', () => {
  it('greets and counts waves', async () => {
    const screen = await render(<Hello name="Ada" />)
    await expect.element(screen.getByText('Hello Ada')).toBeVisible()
    await screen.getByRole('button').click()
    await expect.element(screen.getByRole('button')).toHaveTextContent('waved 1 times')
  })

  it('can be loud', async () => {
    const screen = await render(<Hello name="Ada" tone="loud" />)
    await expect.element(screen.getByText('HELLO ADA')).toBeVisible()
  })
})
`,
  )

  writeFileSync(
    join(app, 'src', 'Excluded.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { recorder } from '@describe-me/vitest'
import { Hello } from './Hello'

describe('Excluded', () => {
  it('renders without recording', async () => {
    const screen = await render(<Hello name="Ada" />)
    await expect.element(screen.getByText('Hello Ada')).toBeVisible()
    expect(recorder.isActive).toBe(false)
  })
})
`,
  )

  writeFileSync(
    join(app, 'src', 'pure.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { recorder } from '@describe-me/vitest'

describe('pure', () => {
  it('records in an included file', () => {
    expect(recorder.isActive).toBe(true)
  })
})
`,
  )

  // Prints the reporters the plugin sets. Arguments become the config's own list.
  writeFileSync(
    join(app, 'reporters.mjs'),
    `import { describeMe } from '@describe-me/vitest/plugin'

const names = process.argv.slice(2)
const test = names.length > 0 ? { reporters: names } : {}
const { reporters } = (await describeMe({ environment: 'browser' }).config({ test })).test

console.log(
  JSON.stringify(
    reporters.map((reporter) => (typeof reporter === 'string' ? reporter : 'describe-me')),
  ),
)
`,
  )
}

/** A component behind a loader, and the tests and configs that document it once loaded. */
function scaffoldTiming() {
  mkdirSync(join(app, 'timing'), { recursive: true })
  mkdirSync(join(app, 'timing-browser'), { recursive: true })

  writeFileSync(
    join(app, 'src', 'Greeting.tsx'),
    `import { useEffect, useState } from 'react'

export interface GreetingProps {
  /** Who to greet once loaded. */
  name: string
}

export function Greeting({ name }: GreetingProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50)

    return () => clearTimeout(timer)
  }, [])

  if (!loaded) {
    return <p aria-busy="true">Loading</p>
  }

  return (
    <>
      <p>{\`Loaded \${name}\`}</p>
      <button type="button">wave</button>
    </>
  )
}
`,
  )

  writeFileSync(
    join(app, 'timing', 'Greeting.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Greeting } from '../src/Greeting'

describe('Greeting', () => {
  it('waves once loaded', async () => {
    render(<Greeting name="Ada" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    await screen.findByText('Loaded Ada')
    fireEvent.click(screen.getByRole('button'))
  })

  it('ends once loaded', async () => {
    render(<Greeting name="Bea" />)
    await screen.findByText('Loaded Bea')
  })
})
`,
  )

  // A broken observer would leave the frame to flush(), which then takes it and returns true.
  writeFileSync(
    join(app, 'timing', 'Observed.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { recorder } from '@describe-me/vitest'
import { Greeting } from '../src/Greeting'

describe('Observed', () => {
  it('is taken by the observer', async () => {
    render(<Greeting name="Cy" />)
    await screen.findByText('Loaded Cy')
    expect(await recorder.flush()).toBe(false)
  })
})
`,
  )

  writeFileSync(
    join(app, 'timing-browser', 'Greeting.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Greeting } from '../src/Greeting'

describe('Greeting', () => {
  it('waves once loaded', async () => {
    const screen = await render(<Greeting name="Ada" />)
    await expect.element(screen.getByText('Loaded Ada')).toBeVisible()
    await screen.getByRole('button').click()
  })
})
`,
  )

  // One config per run, each with its own output directory and tests.
  writeFileSync(
    join(app, 'vitest.lazy.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-lazy', renderFrame: 'lazy' })],
  test: {
    environment: 'jsdom',
    include: ['timing/Greeting.test.tsx'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'vitest.pending.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [
    react(),
    describeMe({ outDir: '.describe-me-pending', renderFrame: { pending: '[aria-busy="true"]' } }),
  ],
  test: {
    environment: 'jsdom',
    include: ['timing/*.test.tsx'],
  },
})
`,
  )

  // jsdom rejects the extra `]`. It accepts an unterminated `[aria-busy="true"`.
  // The warning is printed in the test worker, and the minimal reporter Vitest
  // picks for AI agents hides what passing tests print, so the run names its own.
  writeFileSync(
    join(app, 'vitest.broken-pending.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [
    react(),
    describeMe({
      outDir: '.describe-me-broken-pending',
      renderFrame: { pending: '[aria-busy="true"]]' },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['timing/Greeting.test.tsx'],
    reporters: ['default'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'vitest.lazy-browser.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-lazy-browser', renderFrame: 'lazy' })],
  test: {
    include: ['timing-browser/*.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
`,
  )
}

/**
 * A project whose setup file plants the recorder 0.4 created, before the
 * plugin's own setup file runs: no `protocol` and no `flush()`.
 */
function scaffoldMixed() {
  mkdirSync(join(app, 'mixed'), { recursive: true })

  writeFileSync(
    join(app, 'vitest.mixed.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-mixed' })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./mixed/plant-old-recorder.ts'],
    include: ['mixed/**/*.test.tsx'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'mixed', 'plant-old-recorder.ts'),
    `const scope = globalThis as Record<symbol, unknown>

scope[Symbol.for('describe-me.recorder')] = {
  begin() {},
  isActive: false,
  setComponent() {},
  capture: async () => {},
  end: () => ({ frames: [] }),
  onTeardown() {},
  teardown() {},
}
`,
  )

  writeFileSync(
    join(app, 'mixed', 'Mixed.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Hello } from '../src/Hello'

describe('Mixed', () => {
  it('renders next to an old recorder', () => {
    const screen = render(<Hello name="Ada" />)
    expect(screen.getByText('Hello Ada')).toBeDefined()
  })
})
`,
  )
}

/** Two test files under `include: []`, so a warning repeated per file would show. */
function scaffoldIncludeEmpty() {
  mkdirSync(join(app, 'include-empty'), { recursive: true })

  writeFileSync(
    join(app, 'vitest.include-empty.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-include-empty', include: [] })],
  test: {
    environment: 'jsdom',
    include: ['include-empty/*.test.tsx'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'include-empty', 'Hello.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { recorder } from '@describe-me/vitest'
import { Hello } from '../src/Hello'

describe('Hello', () => {
  it('waves without recording', async () => {
    const screen = render(<Hello name="Ada" />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('waved 1 times')
    expect(recorder.isActive).toBe(false)
  })
})
`,
  )

  writeFileSync(
    join(app, 'include-empty', 'Inactive.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { recorder } from '@describe-me/vitest'

describe('Inactive', () => {
  it('does not record', () => {
    expect(recorder.isActive).toBe(false)
  })
})
`,
  )
}

/** A styled component with a global style, loaded through the browser build in jsdom. */
function scaffoldStyled() {
  mkdirSync(join(app, 'styled'), { recursive: true })

  writeFileSync(
    join(app, 'vitest.styled.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-styled' })],
  test: {
    environment: 'jsdom',
    include: ['styled/*.test.tsx'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'styled', 'Pill.tsx'),
    `import styled, { createGlobalStyle } from 'styled-components'

const Marker = createGlobalStyle\`
  body {
    --smoke-global: applied;
  }
\`

const Label = styled.span\`
  color: rgb(43, 92, 255);
\`

export interface PillProps {
  /** The text inside the pill. */
  label: string
}

export function Pill({ label }: PillProps) {
  return (
    <>
      <Marker />
      <Label>{label}</Label>
    </>
  )
}
`,
  )

  writeFileSync(
    join(app, 'styled', 'Pill.test.tsx'),
    `import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from './Pill'

describe('Pill', () => {
  it('shows its label', () => {
    render(<Pill label="new" />)
    expect(screen.getByText('new')).toBeDefined()
  })
})
`,
  )
}

/**
 * Two registered components and the naming tests of both examples around them.
 * Test-local components stay in the test files, because the plugin never
 * registers a test file's exports.
 */
function scaffoldNaming() {
  mkdirSync(join(app, 'naming'), { recursive: true })
  mkdirSync(join(app, 'naming-browser'), { recursive: true })

  writeFileSync(
    join(app, 'naming', 'Badge.tsx'),
    `import type { ReactNode } from 'react'

export interface BadgeProps {
  /** Which palette the badge uses. */
  tone?: 'info' | 'danger'
  children: ReactNode
}

export function Badge({ tone = 'info', children }: BadgeProps) {
  return <span data-tone={tone}>{children}</span>
}
`,
  )

  writeFileSync(
    join(app, 'naming', 'Panel.tsx'),
    `import type { ReactNode } from 'react'

export interface PanelProps {
  /** Heading shown above the body. */
  title: string
  children: ReactNode
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
`,
  )

  // A lookup that wrongly searches the Shell wrapper would name Panel.
  writeFileSync(
    join(app, 'naming', 'Naming.test.tsx'),
    `import { memo, Suspense, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { Badge } from './Badge'
import { Panel } from './Panel'

const Local = memo(function LocalBadge() {
  return <Badge tone="info">synced</Badge>
})

function SuspendedPanel() {
  return <Panel title="Suspended">Loaded without waiting.</Panel>
}

function Alert() {
  return <Badge tone="danger">rejected</Badge>
}

function Shell({ children }: { children: ReactNode }) {
  return <Panel title="Shell">{children}</Panel>
}

describe('Naming', () => {
  it('names Badge tone=danger inside a ThemeProvider', () => {
    const screen = render(
      <ThemeProvider theme={{}}>
        <Badge tone="danger">overdue</Badge>
      </ThemeProvider>,
    )

    expect(screen.getByText('overdue')).toBeDefined()
  })

  it('names Badge tone=info from a test-local memo', () => {
    const screen = render(<Local />)

    expect(screen.getByText('synced')).toBeDefined()
  })

  it('names Badge tone=danger inside a fragment', () => {
    const screen = render(
      <>
        <Badge tone="danger">fine print</Badge>
      </>,
      { wrapper: Shell },
    )

    expect(screen.getByText('fine print')).toBeDefined()
  })

  it('names Panel title=Suspended inside Suspense', () => {
    const screen = render(
      <Suspense fallback={<Badge tone="info">loading</Badge>}>
        <SuspendedPanel />
      </Suspense>,
    )

    expect(screen.getByText('Suspended')).toBeDefined()
  })

  it('names Badge tone=danger under a wrapper', () => {
    const screen = render(<Alert />, { wrapper: Shell })

    expect(screen.getByText('rejected')).toBeDefined()
  })

  it('names Badge tone=danger after a rerender from an empty fragment', () => {
    const screen = render(<></>)
    screen.rerender(<Badge tone="danger">blocked</Badge>)

    expect(screen.getByText('blocked')).toBeDefined()
  })
})
`,
  )

  // React 18 has a separate Context.Provider object, React 19 renders the context itself.
  writeFileSync(
    join(app, 'naming-browser', 'Naming.test.tsx'),
    `import { createContext, memo, Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Badge } from '../naming/Badge'
import { Panel } from '../naming/Panel'

const Density = createContext('comfortable')

const Local = memo(function LocalBadge() {
  return <Badge tone="info">synced</Badge>
})

function SuspendedPanel() {
  return <Panel title="Suspended">Loaded without waiting.</Panel>
}

describe('Naming', () => {
  it('names Badge tone=danger inside a context provider', async () => {
    const screen = await render(
      <Density.Provider value="compact">
        <Badge tone="danger">overdue</Badge>
      </Density.Provider>,
    )

    await expect.element(screen.getByText('overdue')).toBeVisible()
  })

  it('names Badge tone=info from a test-local memo', async () => {
    const screen = await render(<Local />)

    await expect.element(screen.getByText('synced')).toBeVisible()
  })

  it('names Badge tone=danger inside a fragment', async () => {
    const screen = await render(
      <>
        <Badge tone="danger">fine print</Badge>
      </>,
    )

    await expect.element(screen.getByText('fine print')).toBeVisible()
  })

  it('names Panel title=Suspended inside Suspense', async () => {
    const screen = await render(
      <Suspense fallback={<Badge tone="info">loading</Badge>}>
        <SuspendedPanel />
      </Suspense>,
    )

    await expect.element(screen.getByText('Suspended')).toBeVisible()
  })

  it('names Badge tone=danger after a rerender from an empty fragment', async () => {
    const screen = await render(<></>)
    await screen.rerender(<Badge tone="danger">blocked</Badge>)

    await expect.element(screen.getByText('blocked')).toBeVisible()
  })
})
`,
  )

  writeFileSync(
    join(app, 'vitest.naming.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-naming' })],
  test: {
    environment: 'jsdom',
    include: ['naming/*.test.tsx'],
  },
})
`,
  )

  writeFileSync(
    join(app, 'vitest.naming-browser.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe({ outDir: '.describe-me-naming-browser' })],
  test: {
    include: ['naming-browser/*.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
`,
  )
}

/**
 * A jsdom project without the optional `@testing-library/user-event` peer, and
 * without browser packages or styled-components.
 */
function scaffoldWithoutUserEvent() {
  mkdirSync(join(withoutUserEvent, 'src'), { recursive: true })
  mkdirSync(join(withoutUserEvent, 'dom'), { recursive: true })

  writePackageJson(
    withoutUserEvent,
    'describe-me-smoke-without-user-event',
    pinnedToolchain([
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
      'vitest',
      '@vitejs/plugin-react',
      'typescript',
      '@testing-library/react',
      '@testing-library/dom',
      'jsdom',
      'vite',
    ]),
  )

  writeTsconfig(withoutUserEvent)

  writeFileSync(
    join(withoutUserEvent, 'vitest.config.ts'),
    `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { describeMe } from '@describe-me/vitest/plugin'

export default defineConfig({
  plugins: [react(), describeMe()],
  test: {
    environment: 'jsdom',
    include: ['dom/**/*.test.tsx'],
  },
})
`,
  )

  writeFileSync(join(withoutUserEvent, 'src', 'Hello.tsx'), HELLO_SOURCE)
  writeFileSync(join(withoutUserEvent, 'dom', 'FireEvent.test.tsx'), FIRE_EVENT_TEST)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`smoke: ${message}`)
  }
}

/**
 * Every version of `name` pnpm installed in `project`, from the
 * `<name>@<version>(_<peers>)` store directories. A scope's `/` is a `+` there.
 */
function installedVersions(name, project = app) {
  const prefix = `${name.replace('/', '+')}@`
  const entries = readdirSync(join(project, 'node_modules', '.pnpm'))
  const versions = entries
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => entry.slice(prefix.length).split('_')[0])

  return [...new Set(versions)].sort()
}

/** The reporter Vitest picks for an AI agent: `minimal` from 5.0, `agent` in 4.1 and none in 4.0. */
function agentReporter(version) {
  const [major, minor] = version.split('.').map(Number)

  if (major >= 5) {
    return 'minimal'
  }

  return minor >= 1 ? 'agent' : 'default'
}

/**
 * GitHub Actions sets `GITHUB_ACTIONS` and agent shells set `CLAUDECODE`, so
 * each case gets only its own variables. The import also fails unless the
 * packed `@describe-me/vitest` declares `std-env`.
 */
function verifyDefaultReporters() {
  const version = readJson(join(app, 'node_modules', 'vitest', 'package.json')).version
  const agent = agentReporter(version)
  const both = { CLAUDECODE: '1', GITHUB_ACTIONS: 'true' }

  const cases = [
    { env: {}, names: [], expected: ['default', 'describe-me'] },
    { env: { CLAUDECODE: '1' }, names: [], expected: [agent, 'describe-me'] },
    {
      env: { GITHUB_ACTIONS: 'true' },
      names: [],
      expected: ['default', 'github-actions', 'describe-me'],
    },
    { env: both, names: [], expected: [agent, 'github-actions', 'describe-me'] },
    { env: both, names: ['dot'], expected: ['describe-me'] },
  ]

  for (const { env, names, expected } of cases) {
    const output = execFileSync(process.execPath, ['reporters.mjs', ...names], {
      cwd: app,
      env,
      encoding: 'utf8',
    })

    assert(
      isDeepStrictEqual(JSON.parse(output), expected),
      `expected reporters ${JSON.stringify(expected)} with env ${JSON.stringify(env)} and config reporters ${JSON.stringify(names)}, got ${output.trim()}`,
    )
  }

  console.log(
    `\nreporters: Vitest ${version} keeps its defaults, ${agent} for an agent, github-actions on GitHub Actions`,
  )
}

/**
 * A second, nested Vite means a package ships its own instead of peering on
 * the project's. Directories that differ only in their peer suffix are the
 * same Vite.
 */
function verifySingleVite(pinned) {
  const versions = installedVersions('vite')

  assert(
    versions.length === 1,
    `expected exactly one Vite version, found ${versions.length}: ${versions.join(', ')}`,
  )

  assert(
    !pinned || versions[0] === pinned,
    `expected Vite ${pinned} (from --vite), found ${versions[0]}`,
  )

  console.log(`\nvite: ${versions[0]} (single copy)`)
}

/** Two Reacts would split the fibers the naming reads between copies. */
function verifySingleReact(pinned) {
  const versions = installedVersions('react')

  assert(
    versions.length === 1,
    `expected exactly one React version, found ${versions.length}: ${versions.join(', ')}`,
  )

  assert(
    !pinned || versions[0] === pinned,
    `expected React ${pinned} (from --react), found ${versions[0]}`,
  )

  console.log(`\nreact: ${versions[0]} (single copy)`)
}

/** `pnpm pack` rewrites `workspace:^` to `^<version>`, so a mix is reported at install time. */
function verifyPackedPeers() {
  const packed = (name) => readJson(join(app, 'node_modules', ...name.split('/'), 'package.json'))
  const react = packed('@describe-me/react')
  const vitestPackage = packed('@describe-me/vitest')
  const vitestRange = `^${versionOf('@describe-me/vitest')}`
  const viewerRange = `^${versionOf('describe-me')}`

  assert(
    react.peerDependencies?.['@describe-me/vitest'] === vitestRange,
    `expected @describe-me/react to peer on @describe-me/vitest ${vitestRange}, got ${react.peerDependencies?.['@describe-me/vitest']}`,
  )

  assert(
    vitestPackage.peerDependencies?.['describe-me'] === viewerRange,
    `expected @describe-me/vitest to peer on describe-me ${viewerRange}, got ${vitestPackage.peerDependencies?.['describe-me']}`,
  )

  assert(
    vitestPackage.peerDependenciesMeta?.['describe-me']?.optional === true,
    'expected the describe-me peer of @describe-me/vitest to be optional',
  )

  console.log(`\npeers: @describe-me/vitest ${vitestRange}, describe-me ${viewerRange} (optional)`)
}

/** The guard's message, not the `recorder.beforeInteraction is not a function` that 0.5.0 showed. */
function verifyMixed(output) {
  assert(
    output.includes('must be on the same version'),
    'the mixed run did not fail with "must be on the same version"',
  )

  assert(!output.includes('is not a function'), 'the mixed run printed "is not a function"')
  console.log('\nmixed: fails with "must be on the same version"')
}

/** Per environment: how many tests the manifest holds, and which modules must stay out of it. */
const EXPECTED = {
  browser: { tests: 2, absent: ['Excluded', 'pure'] },
  dom: { tests: 6, absent: ['Excluded', 'pure', 'hook'] },
}

function labelsOf(test) {
  return test.frames.map((frame) => `${frame.kind}:${frame.label}`)
}

/**
 * The frames of the fireEvent test. Its `afterEach(cleanup)` adds no closing
 * frame, and the label names the button as it was before the click.
 */
const FIRE_EVENT_FRAMES = 'render:<Hello name="Ada" /> | action:click(button "waved 0 times")'

/**
 * The frames of the leak pair, by full name. The first test's late action and
 * step must be dropped, and must not hide the second test's click.
 */
const LEAK_FRAMES = {
  'Leak > ends with work it did not await': 'render:<Hello name="Ada" />',
  'Leak > records only its own frames':
    'render:<Hello name="Bea" /> | action:click(button "waved 0 times")',
}

/** Exactly one test per full name, with exactly the expected frames. */
function assertFrames(tests, expected, run) {
  assert(
    tests.length === Object.keys(expected).length,
    `expected ${Object.keys(expected).length} tests (${run}), got ${tests.length}`,
  )

  for (const [fullName, frames] of Object.entries(expected)) {
    const test = tests.find((candidate) => candidate.fullName === fullName)
    const recorded = test ? labelsOf(test).join(' | ') : 'no such test'

    assert(
      recorded === frames,
      `expected ${fullName} to record ${frames} (${run}), got ${recorded}`,
    )
  }
}

/** The hostname of every `href` in a preview head. */
function headHosts(head) {
  return Array.from((head ?? '').matchAll(/href="([^"]*)"/g), (match) => new URL(match[1]).hostname)
}

/**
 * What only the DOM scenario checks: `fireEvent` frames, the monorepo path,
 * the preview head and the leak pair.
 */
function verifyDom(manifest) {
  const moduleById = new Map(manifest.modules.map((module) => [module.id, module]))
  const fireEvent = moduleById.get('dom/FireEvent.test.tsx')?.tests ?? []
  const fired = fireEvent.map((test) => labelsOf(test).join(' | '))

  assert(
    fired.length === 1 && fired[0] === FIRE_EVENT_FRAMES,
    `expected the fireEvent test to record ${FIRE_EVENT_FRAMES}, got ${fired.join(' / ')}`,
  )

  const monorepo = moduleById.get('dom/packages/react/Monorepo.test.tsx')?.tests ?? []

  assert(
    monorepo.some((test) => labelsOf(test).some((label) => label.startsWith('render:<Hello'))),
    'the test under dom/packages/react/ was not redirected: no render frame',
  )

  assert(
    headHosts(manifest.head).some((host) => host === 'fonts.googleapis.com'),
    `the preview head did not reach the manifest: ${manifest.head}`,
  )

  assertFrames(moduleById.get('dom/Leak.test.tsx')?.tests ?? [], LEAK_FRAMES, 'leak pair')
}

function verify(outDir, environment) {
  const manifest = readJson(join(app, outDir, 'manifest.json'))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const labels = tests.flatMap(labelsOf)
  const expected = EXPECTED[environment]

  assert(
    tests.length === expected.tests,
    `expected ${expected.tests} tests in the manifest (${environment}), got ${tests.length}`,
  )

  const ids = manifest.modules.map((module) => module.id)
  assert(
    !ids.some((id) => expected.absent.some((name) => id.includes(name))),
    `an excluded or empty module is in the manifest (${environment}): ${ids.join(', ')}`,
  )

  assert(
    tests.every((test) => test.state === 'passed'),
    'a test did not pass',
  )

  assert(
    labels.some((label) => label.startsWith('render:<Hello')),
    `no render frame; frames were ${labels.join(' | ')}`,
  )

  assert(
    labels.some((label) => label.startsWith('action:click(button')),
    `no click frame (${environment}); frames were ${labels.join(' | ')}`,
  )

  const generator = { name: '@describe-me/vitest', version: versionOf('@describe-me/vitest') }
  assert(
    isDeepStrictEqual(manifest.generator, generator),
    `expected generator ${JSON.stringify(generator)} (${environment}), got ${JSON.stringify(manifest.generator)}`,
  )

  const hello = manifest.components.Hello
  assert(hello, 'component doc for Hello is missing')
  assert(hello.file === 'src/Hello.tsx', `unexpected component file ${hello.file}`)

  const tone = hello.props.find((prop) => prop.name === 'tone')
  assert(
    tone?.kind === 'literals' && tone.values.length === 2,
    'tone prop was not read as two literals',
  )

  if (environment === 'dom') {
    verifyDom(manifest)
  }

  console.log(`\n${environment} frames:`, labels.join(' | '))
  console.log('props of Hello:', hello.props.map((prop) => `${prop.name}: ${prop.type}`).join(', '))
}

const WAVES = 'render:<Greeting name="Ada" /> | action:click(button "wave")'
const ENDS = 'render:<Greeting name="Bea" />'

/** The jsdom runs with a later render frame, and the exact frames of each test. */
const TIMING_RUNS = [
  {
    config: 'vitest.lazy.config.ts',
    outDir: '.describe-me-lazy',
    frames: { 'Greeting > waves once loaded': WAVES, 'Greeting > ends once loaded': ENDS },
  },
  {
    config: 'vitest.pending.config.ts',
    outDir: '.describe-me-pending',
    frames: {
      'Greeting > waves once loaded': WAVES,
      'Greeting > ends once loaded': ENDS,
      'Observed > is taken by the observer': 'render:<Greeting name="Cy" />',
    },
  },
]

const BROKEN_PENDING = {
  config: 'vitest.broken-pending.config.ts',
  outDir: '.describe-me-broken-pending',
  frames: { 'Greeting > waves once loaded': WAVES, 'Greeting > ends once loaded': ENDS },
}

const INVALID_SELECTOR = 'renderFrame.pending is not a valid CSS selector'

/** One test file, so one warning. The render frames must still wait for the loaded Greeting. */
function verifyBrokenPending(output) {
  const warnings = output.split(INVALID_SELECTOR).length - 1

  assert(
    warnings === 1,
    `expected "${INVALID_SELECTOR}" once (${BROKEN_PENDING.outDir}), got ${warnings}`,
  )

  verifyTiming(BROKEN_PENDING)
}

const INCLUDE_EMPTY = {
  config: 'vitest.include-empty.config.ts',
  outDir: '.describe-me-include-empty',
}

const EMPTY_INCLUDE_WARNING = 'include is an empty list'

/** Two test files, but the reporter warns once per Vitest start. */
function verifyIncludeEmpty(output) {
  const warnings = output.split(EMPTY_INCLUDE_WARNING).length - 1

  assert(
    warnings === 1,
    `expected "${EMPTY_INCLUDE_WARNING}" once (${INCLUDE_EMPTY.outDir}), got ${warnings}`,
  )

  const manifest = readJson(join(app, INCLUDE_EMPTY.outDir, 'manifest.json'))

  assert(
    manifest.modules.length === 0,
    `expected no modules (${INCLUDE_EMPTY.outDir}), got ${manifest.modules.length}`,
  )

  assert(
    manifest.setupWarnings === undefined,
    `expected no setup warnings (${INCLUDE_EMPTY.outDir}), got ${JSON.stringify(manifest.setupWarnings)}`,
  )

  console.log('\ninclude-empty: 1 warning, 0 modules')
}

const LAZY_BROWSER = {
  config: 'vitest.lazy-browser.config.ts',
  outDir: '.describe-me-lazy-browser',
}

function timingTestsOf(outDir) {
  const tests = readJson(join(app, outDir, 'manifest.json')).modules.flatMap(
    (module) => module.tests,
  )

  assert(
    tests.every((test) => test.state === 'passed'),
    `a test did not pass (${outDir})`,
  )

  return tests
}

/** A later render frame must show the Greeting loaded, never its loader. */
function verifyLoadedRenders(tests, outDir) {
  for (const test of tests) {
    for (const frame of test.frames.filter((candidate) => candidate.kind === 'render')) {
      const name = frame.meta?.props?.name
      const snapshot = readFileSync(join(app, outDir, frame.snapshot), 'utf8')

      assert(
        snapshot.includes(`Loaded ${name}`) && !snapshot.includes('Loading'),
        `the render frame of ${test.fullName} (${outDir}) does not show "Loaded ${name}" alone`,
      )
    }
  }
}

function verifyTiming({ outDir, frames }) {
  const tests = timingTestsOf(outDir)

  assertFrames(tests, frames, outDir)
  verifyLoadedRenders(tests, outDir)
  console.log(`\n${outDir} frames:`, tests.map((test) => labelsOf(test).join(' | ')).join(' / '))
}

/** A locator's label names the selector Vitest built, so only the start of the click is fixed. */
function verifyLazyBrowser({ outDir }) {
  const tests = timingTestsOf(outDir)
  const labels = tests.flatMap(labelsOf)

  assert(
    tests.length === 1 &&
      labels.length === 2 &&
      labels[0] === 'render:<Greeting name="Ada" />' &&
      labels[1].startsWith('action:click('),
    `expected render:<Greeting name="Ada" /> and a click (${outDir}), got ${labels.join(' | ')}`,
  )

  verifyLoadedRenders(tests, outDir)
  console.log(`\n${outDir} frames:`, labels.join(' | '))
}

/** The naming runs, and how many `names …` tests each manifest must hold. */
const NAMING_RUNS = [
  { config: 'vitest.naming.config.ts', outDir: '.describe-me-naming', count: 6 },
  { config: 'vitest.naming-browser.config.ts', outDir: '.describe-me-naming-browser', count: 5 },
]

// `names Badge tone=danger inside a ThemeProvider`: the component, then the rest of the name.
const NAMING_TEST = /^names ([A-Z]\S*)(.*)$/

/** The `key=value` words at the start of `text`, up to the first word without `=`. */
function expectedProps(text) {
  const props = []

  for (const word of text.trim().split(/\s+/)) {
    const separator = word.indexOf('=')

    if (separator === -1) {
      break
    }

    props.push([word.slice(0, separator), word.slice(separator + 1)])
  }

  return props
}

/** The rule of check-manifest's `namingProblemsIn()`, with the component's file fixed. */
function verifyNamingTest(test, outDir) {
  const match = NAMING_TEST.exec(test.name)

  assert(match, `${test.fullName} (${outDir}) is not a "names <Component> …" test`)
  assert(test.state === 'passed', `${test.fullName} (${outDir}) did not pass`)

  const [, expected, rest] = match
  const { component } = test
  const file = `naming/${expected}.tsx`

  assert(
    component?.name === expected && component.file === file,
    `${test.fullName} (${outDir}): documented as ${component?.name} (${component?.file ?? 'no file'}), expected ${expected} (${file})`,
  )

  const renderFrame = test.frames.findLast((frame) => frame.kind === 'render')

  for (const [key, value] of expectedProps(rest)) {
    const inComponent = String(component.props?.[key])
    const inFrame = String(renderFrame?.meta?.props?.[key])

    assert(
      inComponent === value && inFrame === value,
      `${test.fullName} (${outDir}): ${key} is ${inComponent} in the component and ${inFrame} in the last render frame, expected ${value}`,
    )
  }
}

function verifyNaming(outDir, count) {
  const manifest = readJson(join(app, outDir, 'manifest.json'))
  const tests = manifest.modules.flatMap((module) => module.tests)

  assert(tests.length === count, `expected ${count} naming tests (${outDir}), got ${tests.length}`)

  for (const test of tests) {
    verifyNamingTest(test, outDir)
  }

  console.log(`\n${outDir}: ${count} naming tests`)
}

const STYLED = { config: 'vitest.styled.config.ts', outDir: '.describe-me-styled' }
const STYLE_REFERENCE = /describe-me-style:([0-9a-f]{16}(?:\+[0-9a-f]{16})*)/g

/** A snapshot with its `describe-me-style:` references replaced by the chunks they name. */
function withStyles(snapshot, outDir) {
  return snapshot.replace(STYLE_REFERENCE, (_reference, hashes) =>
    hashes
      .split('+')
      .map((hash) => readFileSync(join(app, outDir, 'styles', `${hash}.css`), 'utf8'))
      .join(''),
  )
}

/**
 * The render frame must carry the component's own rule and the global style,
 * which only the browser build of styled-components inserts in jsdom.
 */
function verifyStyled({ outDir }) {
  const manifest = readJson(join(app, outDir, 'manifest.json'))
  const tests = manifest.modules.flatMap((module) => module.tests)

  assertFrames(tests, { 'Pill > shows its label': 'render:<Pill label="new" />' }, outDir)
  assert(tests[0].state === 'passed', `Pill > shows its label did not pass (${outDir})`)

  assert(
    manifest.setupWarnings === undefined,
    `expected no setup warnings (${outDir}), got ${JSON.stringify(manifest.setupWarnings)}`,
  )

  const snapshot = withStyles(
    readFileSync(join(app, outDir, tests[0].frames[0].snapshot), 'utf8'),
    outDir,
  )

  for (const needle of ['--smoke-global: applied', 'rgb(43, 92, 255)']) {
    assert(snapshot.includes(needle), `the render frame of Pill (${outDir}) lacks ${needle}`)
  }

  console.log(`\n${outDir} frames:`, labelsOf(tests[0]).join(' | '))
}

/** The run only tests a project without user-event if pnpm installed none, not even nested. */
function verifyNoUserEvent() {
  const modules = join(withoutUserEvent, 'node_modules')

  assert(
    !existsSync(join(modules, '@testing-library', 'user-event')),
    'the project without user-event has node_modules/@testing-library/user-event',
  )

  const stored = installedVersions('@testing-library/user-event', withoutUserEvent)

  assert(
    stored.length === 0,
    `the project without user-event has @testing-library/user-event ${stored.join(', ')} in node_modules/.pnpm`,
  )
}

function verifyWithoutUserEvent() {
  const manifest = readJson(join(withoutUserEvent, '.describe-me', 'manifest.json'))
  const tests = manifest.modules.flatMap((module) => module.tests)

  assertFrames(
    tests,
    { 'FireEvent > counts a fired click': FIRE_EVENT_FRAMES },
    'without user-event',
  )

  assert(
    tests[0].state === 'passed',
    'FireEvent > counts a fired click did not pass (without user-event)',
  )

  console.log('\nwithout user-event frames:', labelsOf(tests[0]).join(' | '))
}

/** Both static sites: the default build with font vendoring, and the DOM build without. */
function verifyBuilds() {
  const built = ['site/index.html', 'site/__data/manifest.json', 'site-dom/__data/manifest.json']

  for (const path of built) {
    assert(existsSync(join(app, path)), `static build is missing ${path}`)
  }

  const copied = readFileSync(join(app, 'site', '__data', 'manifest.json'))
  assert(
    copied.equals(readFileSync(join(app, '.describe-me', 'manifest.json'))),
    'the default build changed a manifest that links no remote font',
  )

  const head = readJson(join(app, 'site-dom', '__data', 'manifest.json')).head
  assert(
    headHosts(head).some((host) => host === 'fonts.googleapis.com'),
    `the --no-vendor-fonts build did not keep the Google Fonts link: ${head}`,
  )
}

assertNodeVersion()

try {
  pack()
  scaffold()
  scaffoldTiming()
  scaffoldMixed()
  scaffoldIncludeEmpty()
  scaffoldStyled()
  scaffoldNaming()
  scaffoldWithoutUserEvent()
  // A fresh store, like a new machine: the local store can carry stale optional
  // dependency metadata (pnpm 10.5 skips rolldown's native binding that way).
  run(`pnpm install --store-dir ${join(work, 'store')}`, app)
  installBrowser(app)
  verifyDefaultReporters()
  verifySingleVite(vite)
  verifySingleReact(reactVersion)
  verifyPackedPeers()
  run('pnpm exec vitest run', app)
  run('pnpm exec vitest run --config vitest.dom.config.ts', app)
  run(`pnpm exec vitest run --config ${STYLED.config}`, app)

  for (const timing of [...TIMING_RUNS, LAZY_BROWSER]) {
    run(`pnpm exec vitest run --config ${timing.config}`, app)
  }

  const brokenPending = runPassing(`pnpm exec vitest run --config ${BROKEN_PENDING.config}`, app)
  const includeEmpty = runPassing(`pnpm exec vitest run --config ${INCLUDE_EMPTY.config}`, app)

  for (const naming of NAMING_RUNS) {
    run(`pnpm exec vitest run --config ${naming.config}`, app)
  }

  verifyMixed(runFailing('pnpm exec vitest run --config vitest.mixed.config.ts', app))

  run('pnpm exec describe-me build --data .describe-me --out site', app)
  run('pnpm exec describe-me build --data .describe-me-dom --out site-dom --no-vendor-fonts', app)
  verify('.describe-me', 'browser')
  verify('.describe-me-dom', 'dom')
  verifyStyled(STYLED)

  for (const timing of TIMING_RUNS) {
    verifyTiming(timing)
  }

  verifyBrokenPending(brokenPending)
  verifyIncludeEmpty(includeEmpty)
  verifyLazyBrowser(LAZY_BROWSER)

  for (const naming of NAMING_RUNS) {
    verifyNaming(naming.outDir, naming.count)
  }

  verifyBuilds()

  // Last, so a failure here never hides one in the main project.
  run(`pnpm install --store-dir ${join(work, 'store')}`, withoutUserEvent)
  verifyNoUserEvent()
  run('pnpm exec vitest run', withoutUserEvent)
  verifyWithoutUserEvent()

  console.log('\nsmoke: OK — the tarballs install and work in a fresh project')
} finally {
  if (keep) {
    console.log(`\nsmoke: kept ${work}`)
  } else {
    rmSync(work, { recursive: true, force: true })
  }
}
