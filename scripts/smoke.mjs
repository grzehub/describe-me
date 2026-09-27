/**
 * Verifies the published artifact, not the sources: packs every package,
 * installs the tarballs into a fresh project outside the monorepo, runs the
 * same component through the plugin in browser mode and in jsdom, and builds
 * the static site. Right after the install it checks that exactly one Vite
 * version landed in the project: `describe-me` peers on the host's Vite
 * instead of nesting its own. In both environments one test file is excluded
 * and one renders nothing: each asserts `recorder.isActive` inside the test,
 * which proves that the plugin's options reach the test runtime, and neither
 * may appear in the manifest.
 * The DOM scenario also checks the Testing Library adapter: `fireEvent` under
 * a file-level `afterEach(cleanup)` records exactly its render and click
 * frames, a `renderHook` file is unmounted after each test and stays out of
 * the manifest, and a test file under `packages/react/` is still redirected.
 * Its `previewHead` must reach the manifest. The reporter that writes it
 * imports `@describe-me/core/css-references`, so the packed core must export it.
 * Usage: `pnpm smoke [--keep] [--vite <x.y.z>] [--vitest <x.y.z>]` (keep leaves
 * the temp project for inspection; `--vite` and `--vitest` pin older versions
 * of the user's toolchain).
 */
import { execSync } from 'node:child_process'
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
import { parseArgs } from 'node:util'

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

  for (const name of ['vite', 'vitest']) {
    const version = values[name]

    if (version !== undefined && !EXACT_VERSION.test(version)) {
      throw new Error(`smoke: --${name} expects an exact version like 6.4.3, got "${version}"`)
    }
  }

  return { keep: values.keep, vite: values.vite, vitest: values.vitest }
}

const { keep, vite, vitest } = parseOptions()
const work = mkdtempSync(join(tmpdir(), 'describe-me-smoke-'))
const tarballs = join(work, 'tarballs')
const app = join(work, 'app')

/** Run a command in the given directory; `quiet` swallows its output unless it fails. */
function run(command, cwd, quiet = false) {
  console.log(`\n$ ${command}  (${cwd.replace(work, '<tmp>')})`)
  execSync(command, { cwd, stdio: quiet ? 'pipe' : 'inherit', env: { ...process.env, CI: '1' } })
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
 * The toolchain with the command-line pins applied. The playwright provider
 * peers the exact matching Vitest, so `--vitest` moves both.
 */
function pinnedToolchain(names) {
  const picked = toolchain(names)

  if (vite) {
    picked.vite = vite
  }

  if (vitest) {
    picked.vitest = vitest
    picked['@vitest/browser-playwright'] = vitest
  }

  return picked
}

function scaffold() {
  mkdirSync(join(app, 'src'), { recursive: true })

  // Every package points at its tarball, and the overrides make pnpm resolve
  // the packages' own `@describe-me/core` dependency to the tarball too,
  // instead of asking the registry for a version that is not published yet.
  // Vite is deliberately not overridden: the single-Vite check has to prove
  // that the peer lets pnpm reuse the project's own Vite.
  const local = Object.fromEntries(
    manifests.map((manifest) => [manifest.name, `file:${join(tarballs, tarballName(manifest))}`]),
  )

  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify(
      {
        name: 'describe-me-smoke',
        private: true,
        type: 'module',
        devDependencies: {
          ...local,
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
        },
        pnpm: { overrides: local },
      },
      null,
      2,
    ),
  )

  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          types: ['vitest/browser'],
        },
        include: ['src', 'vitest.config.ts'],
      },
      null,
      2,
    ),
  )

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

  writeFileSync(
    join(app, 'dom', 'FireEvent.test.tsx'),
    `import { afterEach, describe, expect, it } from 'vitest'
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

  writeFileSync(
    join(app, 'src', 'Hello.tsx'),
    `import { useState } from 'react'

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
`,
  )

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
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`smoke: ${message}`)
  }
}

/** Every Vite version pnpm installed, from the `vite@<version>(_<peers>)` store directories. */
function installedViteVersions() {
  const entries = readdirSync(join(app, 'node_modules', '.pnpm'))
  const versions = entries
    .filter((entry) => entry.startsWith('vite@'))
    .map((entry) => entry.slice('vite@'.length).split('_')[0])

  return [...new Set(versions)].sort()
}

/**
 * A second, nested Vite means a package ships its own instead of peering on
 * the project's. Directories that differ only in their peer suffix are the
 * same Vite.
 */
function verifySingleVite(pinned) {
  const versions = installedViteVersions()

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

/** Per environment: how many tests the manifest holds, and which modules must stay out of it. */
const EXPECTED = {
  browser: { tests: 2, absent: ['Excluded', 'pure'] },
  dom: { tests: 4, absent: ['Excluded', 'pure', 'hook'] },
}

function labelsOf(test) {
  return test.frames.map((frame) => `${frame.kind}:${frame.label}`)
}

/**
 * The frames of the fireEvent test. Its `afterEach(cleanup)` adds no closing
 * frame, and the label names the button as it was before the click.
 */
const FIRE_EVENT_FRAMES = 'render:<Hello name="Ada" /> | action:click(button "waved 0 times")'

/** What only the DOM scenario checks: `fireEvent` frames, the monorepo path and the preview head. */
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

  const headHosts = Array.from(
    (manifest.head ?? '').matchAll(/href="([^"]*)"/g),
    (match) => new URL(match[1]).hostname,
  )

  assert(
    headHosts.includes('fonts.googleapis.com'),
    `the preview head did not reach the manifest: ${manifest.head}`,
  )
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

assertNodeVersion()

try {
  pack()
  scaffold()
  // A fresh store, like a new machine: the local store can carry stale optional
  // dependency metadata (pnpm 10.5 skips rolldown's native binding that way).
  run(`pnpm install --store-dir ${join(work, 'store')}`, app)
  verifySingleVite(vite)
  run('pnpm exec vitest run', app)
  run('pnpm exec vitest run --config vitest.dom.config.ts', app)
  run('pnpm exec describe-me build --data .describe-me --out site', app)
  verify('.describe-me', 'browser')
  verify('.describe-me-dom', 'dom')

  for (const path of ['site/index.html', 'site/__data/manifest.json']) {
    assert(existsSync(join(app, path)), `static build is missing ${path}`)
  }

  console.log('\nsmoke: OK — the tarballs install and work in a fresh project')
} finally {
  if (keep) {
    console.log(`\nsmoke: kept ${work}`)
  } else {
    rmSync(work, { recursive: true, force: true })
  }
}
