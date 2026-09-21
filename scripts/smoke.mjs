/**
 * Verifies the published artifact, not the sources: packs every package,
 * installs the tarballs into a fresh project outside the monorepo, runs one
 * browser-mode test through the plugin and builds the static site.
 * Usage: `pnpm smoke [--keep]` (keep leaves the temp project for inspection).
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const keep = process.argv.includes('--keep')
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
const example = readJson(join(root, 'examples', 'react-basic', 'package.json'))
const rootManifest = readJson(join(root, 'package.json'))

/** The user's toolchain, pinned to what the example and the repo run on, so there is one source of truth. */
function toolchain(names) {
  const versions = {
    ...rootManifest.devDependencies,
    ...example.dependencies,
    ...example.devDependencies,
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

function scaffold() {
  mkdirSync(join(app, 'src'), { recursive: true })

  // Every package points at its tarball, and the overrides make pnpm resolve
  // the packages' own `@describe-me/core` dependency to the tarball too,
  // instead of asking the registry for a version that is not published yet.
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
          ...toolchain([
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
  plugins: [react(), describeMe()],
  test: {
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
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`smoke: ${message}`)
  }
}

function verify() {
  const manifest = readJson(join(app, '.describe-me', 'manifest.json'))
  const tests = manifest.modules.flatMap((module) => module.tests)
  const frames = tests.flatMap((test) => test.frames)
  const labels = frames.map((frame) => `${frame.kind}:${frame.label}`)

  assert(tests.length === 2, `expected 2 tests in the manifest, got ${tests.length}`)
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
    `no click frame from a locator call; frames were ${labels.join(' | ')}`,
  )

  const hello = manifest.components.Hello
  assert(hello, 'component doc for Hello is missing')
  assert(hello.file === 'src/Hello.tsx', `unexpected component file ${hello.file}`)

  const tone = hello.props.find((prop) => prop.name === 'tone')
  assert(
    tone?.kind === 'literals' && tone.values.length === 2,
    'tone prop was not read as two literals',
  )

  for (const path of ['site/index.html', 'site/__data/manifest.json']) {
    assert(existsSync(join(app, path)), `static build is missing ${path}`)
  }

  console.log('\nframes:', labels.join(' | '))
  console.log('props of Hello:', hello.props.map((prop) => `${prop.name}: ${prop.type}`).join(', '))
}

assertNodeVersion()

try {
  pack()
  scaffold()
  // A fresh store, like a new machine: the local store can carry stale optional
  // dependency metadata (pnpm 10.5 skips rolldown's native binding that way).
  run(`pnpm install --store-dir ${join(work, 'store')}`, app)
  run('pnpm exec vitest run', app)
  run('pnpm exec describe-me build --data .describe-me --out site', app)
  verify()
  console.log('\nsmoke: OK — the tarballs install and work in a fresh project')
} finally {
  if (keep) {
    console.log(`\nsmoke: kept ${work}`)
  } else {
    rmSync(work, { recursive: true, force: true })
  }
}
