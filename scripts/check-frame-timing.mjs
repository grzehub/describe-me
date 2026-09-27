/**
 * Checks how @describe-me/core compacts a test's frame slots and how
 * @describe-me/vitest validates the `renderFrame` option, on their built
 * output. Run after `pnpm build`. Exits 1 on the first mismatch.
 *
 * Usage: `node scripts/check-frame-timing.mjs`
 */
import { isDeepStrictEqual } from 'node:util'
import { compactFrames } from '../packages/core/dist/compact-frames.js'
import { validateRenderFrame } from '../packages/vitest/dist/validate-render-frame.js'

const RENDER_LABEL = '<Card title="Hi" />'

// Slots as `capture()` reserves them. `filled()` adds what the snapshot sets.
const RENDER = { kind: 'render', label: RENDER_LABEL, meta: { props: { title: 'Hi' } } }
const ACTION = { kind: 'action', label: 'click(button "Save")' }
const END = { kind: 'end', label: 'end of test' }

function stepSlot(label) {
  return { kind: 'step', label }
}

function filled(slot, snapshot, at = 1) {
  return { ...slot, at, snapshot }
}

function fail(name, detail) {
  console.error(`FAIL  ${name} (${detail})`)
  console.error('check-frame-timing: stopped at the first mismatch')
  process.exit(1)
}

function pass(name) {
  console.log(`ok    ${name}`)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** Frozen, so `compactFrames` throws if it writes to its input. */
function frozen(slots) {
  return Object.freeze(slots.map((slot) => Object.freeze({ ...slot })))
}

/** One line per frame, e.g. `f0 render:<Card title="Hi" /> [A]`. */
function describeFrames(frames) {
  return frames.map((frame) => `${frame.id} ${frame.kind}:${frame.label} [${frame.snapshot}]`)
}

function expectFrames(name, slots, expected) {
  let frames

  try {
    frames = compactFrames(frozen(slots))
  } catch (error) {
    fail(name, `threw: ${errorMessage(error)}`)
  }

  const actual = describeFrames(frames)

  if (!isDeepStrictEqual(actual, expected)) {
    fail(name, `expected ${expected.join(' | ')}, got ${actual.join(' | ')}`)
  }

  pass(name)
}

function checkDedupe() {
  expectFrames(
    '[render A, end A] gives [render A]',
    [filled(RENDER, 'A'), filled(END, 'A')],
    [`f0 render:${RENDER_LABEL} [A]`],
  )

  expectFrames(
    '[render A, end B] keeps both',
    [filled(RENDER, 'A'), filled(END, 'B')],
    [`f0 render:${RENDER_LABEL} [A]`, 'f1 end:end of test [B]'],
  )

  expectFrames(
    '[render A, action A] keeps both',
    [filled(RENDER, 'A'), filled(ACTION, 'A')],
    [`f0 render:${RENDER_LABEL} [A]`, 'f1 action:click(button "Save") [A]'],
  )

  expectFrames(
    '[render A, render A] keeps both',
    [filled(RENDER, 'A'), filled(RENDER, 'A')],
    [`f0 render:${RENDER_LABEL} [A]`, `f1 render:${RENDER_LABEL} [A]`],
  )

  expectFrames(
    '[render A, step A "open"] names the render frame',
    [filled(RENDER, 'A'), filled(stepSlot('open'), 'A')],
    [`f0 step:open · ${RENDER_LABEL} [A]`],
  )

  expectFrames('a lone step is kept', [filled(stepSlot('open'), 'A')], ['f0 step:open [A]'])
}

function checkUnfilledAndReopened() {
  expectFrames(
    '[render A, unfilled action, end B] numbers the kept frames f0 and f1',
    [filled(RENDER, 'A'), ACTION, filled(END, 'B')],
    [`f0 render:${RENDER_LABEL} [A]`, 'f1 end:end of test [B]'],
  )

  expectFrames(
    '[render A, end B, render C] turns the closing frame into a step',
    [filled(RENDER, 'A'), filled(END, 'B'), filled(RENDER, 'C')],
    [
      `f0 render:${RENDER_LABEL} [A]`,
      'f1 step:before cleanup() [B]',
      `f2 render:${RENDER_LABEL} [C]`,
    ],
  )

  expectFrames(
    '[render A, end B, unfilled action] turns the closing frame into a step',
    [filled(RENDER, 'A'), filled(END, 'B'), ACTION],
    [`f0 render:${RENDER_LABEL} [A]`, 'f1 step:before cleanup() [B]'],
  )

  expectFrames(
    '[render A, end B, step B "again"] names the reopened frame',
    [filled(RENDER, 'A'), filled(END, 'B'), filled(stepSlot('again'), 'B')],
    [`f0 render:${RENDER_LABEL} [A]`, 'f1 step:again · before cleanup() [B]'],
  )
}

function checkInputUntouched() {
  const name = 'the input array and its slots are left unchanged'
  const slots = [filled(RENDER, 'A'), filled(END, 'B'), filled(stepSlot('again'), 'B'), ACTION]
  const before = structuredClone(slots)
  const frames = compactFrames(slots)

  if (!isDeepStrictEqual(slots, before)) {
    fail(name, `slots became ${JSON.stringify(slots)}`)
  }

  if (frames.some((frame) => slots.includes(frame))) {
    fail(name, 'a returned frame is one of the input slots')
  }

  pass(name)
}

function checkFieldsCarryOver() {
  const name = 'at and meta carry over'
  const [frame] = compactFrames([filled(RENDER, 'A', 7)])

  if (frame.at !== 7 || !isDeepStrictEqual(frame.meta, RENDER.meta)) {
    fail(name, `got at ${frame.at}, meta ${JSON.stringify(frame.meta)}`)
  }

  pass(name)
}

const ACCEPTED = [
  [undefined, 'eager'],
  ['eager', 'eager'],
  ['lazy', 'lazy'],
  [{ pending: '[aria-busy="true"]' }, { pending: '[aria-busy="true"]' }],
  [
    { pending: '.x', timeout: 500 },
    { pending: '.x', timeout: 500 },
  ],
]

const REJECTED = [
  'sometimes',
  true,
  null,
  {},
  { pending: '' },
  { pending: 1 },
  { pending: '.x', timeout: 0 },
  { pending: '.x', timeout: -1 },
  { pending: '.x', timeout: '2s' },
  { pending: '.x', timeOut: 500 },
]

function shown(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function checkAccepted() {
  for (const [value, expected] of ACCEPTED) {
    const name = `renderFrame ${shown(value)} is accepted`
    let result

    try {
      result = validateRenderFrame(value)
    } catch (error) {
      fail(name, `threw: ${errorMessage(error)}`)
    }

    if (!isDeepStrictEqual(result, expected)) {
      fail(name, `expected ${shown(expected)}, got ${shown(result)}`)
    }

    pass(name)
  }
}

function checkRejected() {
  for (const value of REJECTED) {
    const name = `renderFrame ${shown(value)} is rejected`
    let message

    try {
      validateRenderFrame(value)
    } catch (error) {
      message = errorMessage(error)
    }

    if (message === undefined) {
      fail(name, 'did not throw')
    }

    if (!message.startsWith('describe-me: renderFrame')) {
      fail(name, `threw "${message}"`)
    }

    pass(name)
  }
}

checkDedupe()
checkUnfilledAndReopened()
checkInputUntouched()
checkFieldsCarryOver()
checkAccepted()
checkRejected()
