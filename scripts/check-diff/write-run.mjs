import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stableTestIds } from '../../packages/vitest/dist/stable-test-ids.js'
import { contentName } from './snapshot.mjs'

export const CURRENT = { name: '@describe-me/vitest', version: '0.12.1' }

function vitestId(moduleIndex, testIndex) {
  return `-${1000 + moduleIndex}_0_${testIndex}`
}

function storedFrame(dir, frame, index) {
  let path = frame.path

  if (path === undefined) {
    const text = JSON.stringify(frame.snapshot)
    path = `snapshots/${contentName(text)}.json`
    writeFileSync(join(dir, path), text)
  }

  return {
    id: `f${index}`,
    kind: index === 0 ? 'render' : 'action',
    label: frame.label ?? `frame ${index}`,
    at: frame.at ?? index * 10,
    ...(frame.meta === undefined ? {} : { meta: frame.meta }),
    snapshot: path,
  }
}

function moduleOf(dir, id, specs, moduleIndex, legacy) {
  const stableIds = stableTestIds(id.replaceAll('\\', '/'), specs)

  return {
    id,
    tests: specs.map((spec, testIndex) => {
      const ids = legacy
        ? { id: vitestId(moduleIndex, testIndex) }
        : { id: stableIds[testIndex], vitestId: vitestId(moduleIndex, testIndex) }

      return {
        ...ids,
        name: spec.name,
        path: spec.path,
        fullName: [...spec.path, spec.name].join(' > '),
        state: spec.state ?? 'passed',
        ...(spec.duration === undefined ? {} : { duration: spec.duration }),
        frames: spec.frames.map((frame, index) => storedFrame(dir, frame, index)),
      }
    }),
  }
}

/**
 * Write a data directory as the reporter would: content-named snapshots and
 * a manifest with stable test ids. `tests` is a flat list of
 * `{ module, path, name, state?, duration?, frames }`, each frame
 * `{ snapshot, label?, at?, meta? }` or `{ path }` for a given snapshot path.
 * `legacy` writes Vitest's ids without `vitestId`, as before 0.5.
 * `generator: null` leaves the generator out.
 */
export function writeRun(dir, { tests, components = {}, generator = CURRENT, legacy = false }) {
  mkdirSync(join(dir, 'snapshots'), { recursive: true })

  const byModule = new Map()

  for (const spec of tests) {
    byModule.set(spec.module, [...(byModule.get(spec.module) ?? []), spec])
  }

  const modules = [...byModule].map(([id, specs], index) => moduleOf(dir, id, specs, index, legacy))

  const manifest = {
    version: 1,
    ...(generator === null ? {} : { generator }),
    generatedAt: '2026-01-01T00:00:00.000Z',
    root: '/project',
    modules,
    components,
  }

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
}
