import type { ManifestFrame, ManifestGenerator } from '@describe-me/core/types'
import type {
  ChangeKind,
  ChangesCounts,
  ChangesReport,
  ChangesRun,
  FrameChange,
  StateChange,
  TestChange,
  TestPlace,
} from './changes-report.js'
import { diffComponents } from './diff-components.js'
import type { DomKeyOf } from './pair-frames.js'
import { pairFrames } from './pair-frames.js'
import type { DiffRun } from './read-run.js'
import { readSnapshot } from './read-snapshot.js'
import { snapshotDomKey } from './snapshot-dom-key.js'
import type { IndexedTest } from './test-index.js'
import { testIndex } from './test-index.js'

interface EntryParts {
  kind?: ChangeKind
  state?: StateChange
  from?: TestPlace
  frames: FrameChange[]
}

function generatorOf(run: DiffRun): ManifestGenerator | undefined {
  const generator: unknown = run.manifest.generator

  if (typeof generator !== 'object' || generator === null) {
    return undefined
  }

  const { name, version } = generator as Record<string, unknown>

  return typeof name === 'string' && typeof version === 'string' ? { name, version } : undefined
}

function runOf(run: DiffRun): ChangesRun {
  const generator = generatorOf(run)
  const generatedAt = String(run.manifest.generatedAt ?? '')

  return generator === undefined ? { generatedAt } : { generator, generatedAt }
}

function versionsDiffer(base: ChangesRun, head: ChangesRun): boolean {
  if (base.generator === undefined || head.generator === undefined) {
    return base.generator !== head.generator
  }

  return base.generator.version !== head.generator.version
}

/** Snapshot names are content names, so one key per side and name is enough. */
function domKeyCache(base: DiffRun, head: DiffRun): DomKeyOf {
  const keys = new Map<string, string>()

  return (side, snapshot) => {
    const cacheKey = `${side}\0${snapshot}`
    let key = keys.get(cacheKey)

    if (key === undefined) {
      key = snapshotDomKey(readSnapshot(side === 'base' ? base.dir : head.dir, snapshot))
      keys.set(cacheKey, key)
    }

    return key
  }
}

/** Snapshot names in order, which alone tell whether a test's frames changed. */
function sequenceOf(test: IndexedTest): string {
  return JSON.stringify(test.test.frames.map((frame) => frame.snapshot))
}

function everyFrame(frames: ManifestFrame[], change: 'added' | 'removed'): FrameChange[] {
  return frames.map((frame, index) => {
    const side = { index, label: String(frame.label ?? ''), snapshot: frame.snapshot }

    return change === 'added' ? { change, head: side } : { change, base: side }
  })
}

function stateChange(base: IndexedTest, head: IndexedTest): StateChange | undefined {
  if (base.test.state === head.test.state) {
    return undefined
  }

  return { base: base.test.state, head: head.test.state }
}

/** Fields in the order of `TestChange`, without the absent ones. */
function entryOf(change: TestChange['change'], test: IndexedTest, parts: EntryParts): TestChange {
  return {
    change,
    id: test.id,
    module: test.module,
    fullName: test.test.fullName,
    ...(parts.kind === undefined ? {} : { kind: parts.kind }),
    ...(parts.state === undefined ? {} : { state: parts.state }),
    ...(parts.from === undefined ? {} : { from: parts.from }),
    frames: parts.frames,
  }
}

/**
 * Each head-only test with the snapshots of a base-only test, in head order,
 * with the first such base test not taken yet. Tests without frames never pair.
 */
function movedTests(baseOnly: IndexedTest[], headOnly: IndexedTest[]): Map<string, IndexedTest> {
  const waiting = new Map<string, IndexedTest[]>()

  for (const test of baseOnly) {
    if (test.test.frames.length > 0) {
      const sequence = sequenceOf(test)
      waiting.set(sequence, [...(waiting.get(sequence) ?? []), test])
    }
  }

  const moved = new Map<string, IndexedTest>()

  for (const test of headOnly) {
    const from = waiting.get(sequenceOf(test))?.shift()

    if (from !== undefined) {
      moved.set(test.id, from)
    }
  }

  return moved
}

function emptyCounts(): ChangesCounts {
  return {
    tests: { changed: 0, dom: 0, css: 0, added: 0, removed: 0, moved: 0, unchanged: 0 },
    frames: { changed: 0, dom: 0, css: 0, added: 0, removed: 0, unchanged: 0 },
  }
}

/** Tallies every entry, its frames included. `unchanged` is counted while comparing. */
function tally(counts: ChangesCounts, tests: TestChange[]): void {
  for (const test of tests) {
    counts.tests[test.change]++

    if (test.kind !== undefined) {
      counts.tests[test.kind]++
    }

    for (const frame of test.frames) {
      if (frame.kind === undefined) {
        counts.frames[frame.change as 'added' | 'removed']++
      } else {
        counts.frames[frame.kind]++
        counts.frames.changed++
      }
    }
  }
}

/** Compare a test that both runs have. `undefined` when it did not change. */
function compareTest(
  base: IndexedTest,
  head: IndexedTest,
  counts: ChangesCounts,
  domKeyOf: DomKeyOf,
): TestChange | undefined {
  const state = stateChange(base, head)

  if (sequenceOf(base) === sequenceOf(head)) {
    counts.frames.unchanged += head.test.frames.length

    if (state === undefined) {
      counts.tests.unchanged++
      return undefined
    }

    return entryOf('changed', head, { state, frames: [] })
  }

  const { frames, unchanged } = pairFrames(base.test.frames, head.test.frames, domKeyOf)
  counts.frames.unchanged += unchanged

  const kind = frames.some((frame) => frame.kind !== 'css') ? 'dom' : 'css'

  return entryOf('changed', head, { kind, state, frames })
}

function movedEntry(from: IndexedTest, head: IndexedTest, counts: ChangesCounts): TestChange {
  counts.frames.unchanged += head.test.frames.length

  return entryOf('moved', head, {
    state: stateChange(from, head),
    from: { id: from.id, module: from.module, fullName: from.test.fullName },
    frames: [],
  })
}

/**
 * Compare two runs: tests by id, frames by snapshot name and DOM key, and the
 * props of the components on both sides. A test whose snapshots and state
 * are the same is only counted, without reading its files.
 */
export function diffRuns(base: DiffRun, head: DiffRun): ChangesReport {
  const baseTests = testIndex(base.manifest)
  const headTests = testIndex(head.manifest)
  const baseOnly = [...baseTests.values()].filter((test) => !headTests.has(test.id))
  const headOnly = [...headTests.values()].filter((test) => !baseTests.has(test.id))
  const moved = movedTests(baseOnly, headOnly)
  const movedFrom = new Set([...moved.values()].map((test) => test.id))
  const domKeyOf = domKeyCache(base, head)
  const counts = emptyCounts()
  const tests: TestChange[] = []

  for (const test of headTests.values()) {
    const before = baseTests.get(test.id)
    const from = moved.get(test.id)
    let entry: TestChange | undefined

    if (before !== undefined) {
      entry = compareTest(before, test, counts, domKeyOf)
    } else if (from !== undefined) {
      entry = movedEntry(from, test, counts)
    } else {
      entry = entryOf('added', test, { frames: everyFrame(test.test.frames, 'added') })
    }

    if (entry !== undefined) {
      tests.push(entry)
    }
  }

  for (const test of baseOnly) {
    if (!movedFrom.has(test.id)) {
      tests.push(entryOf('removed', test, { frames: everyFrame(test.test.frames, 'removed') }))
    }
  }

  tally(counts, tests)

  const baseRun = runOf(base)
  const headRun = runOf(head)

  return {
    version: 1,
    base: baseRun,
    head: headRun,
    versionsDiffer: versionsDiffer(baseRun, headRun),
    counts,
    tests,
    components: diffComponents(base.manifest.components, head.manifest.components),
  }
}
