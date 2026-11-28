import { CURRENT } from './write-run.mjs'

const LONG_NAME = 'a test with a rather long name that keeps going '.repeat(2).trimEnd()

function changedTest(i, look) {
  const id = i.toString(16).padStart(12, '0')

  return {
    change: 'changed',
    id,
    module: `src/${'deeply/nested/'.repeat(4)}module-${i % 20}.test.tsx`,
    fullName: `Suite ${i} > ${LONG_NAME}`,
    kind: 'dom',
    look,
    ...(look === 'different' ? { shot: { file: `${id}.png`, frame: 0 } } : {}),
    frames: [
      {
        change: 'changed',
        kind: 'dom',
        look,
        base: { index: 0, label: 'render', snapshot: 'snapshots/0000000000000000.json' },
        head: { index: 0, label: 'render', snapshot: 'snapshots/1111111111111111.json' },
      },
    ],
  }
}

/**
 * A `changes.json` written with `--shots`, without the files it names: first
 * `different` tests that look different, each with the image `<id>.png`, then
 * `same` tests whose DOM changed and which look the same. Ids count up from
 * `000000000000`, so two reports with an image each name the same file.
 */
export function shotsReport({ different = 0, same = 0 } = {}) {
  const tests = [
    ...Array.from({ length: different }, (_, i) => changedTest(i, 'different')),
    ...Array.from({ length: same }, (_, i) => changedTest(different + i, 'same')),
  ]

  const changed = tests.length

  return {
    version: 1,
    base: { generator: CURRENT, generatedAt: '' },
    head: { generator: CURRENT, generatedAt: '' },
    versionsDiffer: false,
    counts: {
      tests: { changed, dom: changed, css: 0, added: 0, removed: 0, moved: 0, unchanged: 0 },
      frames: { changed, dom: changed, css: 0, added: 0, removed: 0, unchanged: 0 },
    },
    tests,
    components: [],
    shots: {
      width: 480,
      pixelRatio: 2,
      maxShots: Math.max(12, different),
      pairs: changed,
      differentPairs: different,
      failedPairs: 0,
      images: different,
    },
  }
}
