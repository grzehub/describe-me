/**
 * Spike: which frames differ between two describe-me output directories.
 * Tests are matched by their stable id and frames by their place, and a frame
 * counts as changed when its snapshot file has another name. Matching frames
 * by place is good enough here. The real diff has to match them by snapshot,
 * or one added step marks every later frame as changed. Prints JSON.
 *
 * Usage: `node spike/pr-attach/changed-frames.mjs <baseDir> <headDir>`
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const [baseDir, headDir] = process.argv.slice(2)

function testsOf(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const tests = new Map()

  for (const module of manifest.modules) {
    for (const test of module.tests) {
      tests.set(test.id, { module: module.id, ...test })
    }
  }

  return tests
}

function changedFrames(before, after) {
  const frames = []

  for (const [index, frame] of after.frames.entries()) {
    const earlier = before.frames[index]

    if (earlier !== undefined && earlier.snapshot !== frame.snapshot) {
      frames.push({ index, label: frame.label, base: earlier.snapshot, head: frame.snapshot })
    }
  }

  return frames
}

const base = testsOf(baseDir)
const changed = []

for (const [id, test] of testsOf(headDir)) {
  const before = base.get(id)
  const frames = before === undefined ? [] : changedFrames(before, test)

  if (frames.length > 0) {
    changed.push({ id, module: test.module, fullName: test.fullName, frames })
  }
}

console.log(JSON.stringify(changed, null, 2))
