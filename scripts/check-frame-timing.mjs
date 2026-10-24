/**
 * Checks how @describe-me/core compacts a test's frame slots and how
 * @describe-me/vitest validates the `renderFrame` option, on their built
 * output. Also checks that the recorder falls back to `'lazy'`, with one
 * warning, for a `pending` selector the DOM rejects.
 *
 * Then, on a jsdom page, it checks when `recordAction()` of
 * @describe-me/vitest and `recordSyncAction()` of @describe-me/react note
 * what a gesture did to hover and focus. The render frame an interaction
 * takes before it runs never shows its gesture, and an interaction that
 * throws changes nothing. A call nested in another notes its gesture too, and
 * the outermost call notes last. A `recordAction()` that outlives its test
 * changes nothing in the next one. Run after `pnpm build`. Exits 1 on the
 * first mismatch.
 *
 * Usage: `node scripts/check-frame-timing.mjs`
 */
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { compactFrames } from '../packages/core/dist/compact-frames.js'
import { recorder } from '../packages/core/dist/recorder.js'
import { recordSyncAction } from '../packages/react/dist/record-sync-action.js'
import { recordAction } from '../packages/vitest/dist/record-action.js'
import { validateRenderFrame } from '../packages/vitest/dist/validate-render-frame.js'

// jsdom is a dependency of the jsdom example, not of the root.
const { JSDOM } = createRequire(new URL('../examples/react-jsdom/package.json', import.meta.url))(
  'jsdom',
)

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

const BROKEN_SELECTOR = '[aria-busy="true"]]'

/** A `document` whose `querySelector` rejects `BROKEN_SELECTOR`, as jsdom does, and counts its calls. */
function stubDocument() {
  const stub = {
    queries: 0,
    querySelector(selector) {
      stub.queries++

      if (selector === BROKEN_SELECTOR) {
        throw new SyntaxError(`'${selector}' is not a valid selector`)
      }

      return null
    },
  }

  return stub
}

async function checkRejectedSelector() {
  const name = `renderFrame { pending: '${BROKEN_SELECTOR}' } falls back to 'lazy' with one warning`
  const stub = stubDocument()
  const warnings = []
  const warn = console.warn
  globalThis.document = stub
  console.warn = (...args) => warnings.push(args.join(' '))

  try {
    try {
      recorder.configure({ renderFrame: { pending: BROKEN_SELECTOR } })
    } catch (error) {
      fail(name, `configure threw: ${errorMessage(error)}`)
    }

    const [warning = ''] = warnings

    if (
      warnings.length !== 1 ||
      !warning.includes(BROKEN_SELECTOR) ||
      !warning.includes("'lazy'")
    ) {
      fail(name, `expected one warning naming the selector and 'lazy', got ${shown(warnings)}`)
    }

    // The pending mode would query the selector through `PendingRender.isReady`. Lazy never does.
    const queries = stub.queries
    recorder.begin()
    await recorder.capture('render', RENDER_LABEL)

    if (stub.queries !== queries) {
      fail(name, `the render capture queried the DOM ${stub.queries - queries} time(s)`)
    }

    recorder.end()
    recorder.configure({})
  } finally {
    delete globalThis.document
    console.warn = warn
  }

  pass(name)
}

const STATES_ATTRIBUTE = 'data-describe-me-states'
const PAGE = '<main><button id="save">Save</button></main>'
const INTERACTION_ERROR = 'the interaction failed'

const RENDER_FRAME = `render:${RENDER_LABEL} []`
const HOVER = 'hover(button "Save")'
const CLICK = 'click(button "Save")'
const SHIFT = 'keyboard("{Shift}")'
const MOUSE_ENTER = 'mouseEnter(button "Save")'
const MOUSE_OVER = 'mouseOver(button "Save")'
const MOUSE_LEAVE = 'mouseLeave(button "Save")'

const KEYBOARD_GESTURE = { kind: 'keyboard' }
const POINTER_GESTURE = { kind: 'pointer' }
const UNHOVER_GESTURE = { kind: 'unhover' }

function hoverGesture(target) {
  return { kind: 'hover', target }
}

/**
 * Give this process the globals of a jsdom window, as Vitest's jsdom
 * environment does, so that the recorder can snapshot its document. Returns
 * a function that takes them away again.
 */
function installDom() {
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost/',
  })

  const added = Object.getOwnPropertyNames(window).filter((key) => !(key in globalThis))

  for (const key of added) {
    Object.defineProperty(globalThis, key, { configurable: true, get: () => window[key] })
  }

  return () => {
    for (const key of added) {
      delete globalThis[key]
    }
  }
}

/** The elements of a snapshot that have an `id` and states, e.g. `#save(hover focus)`. */
function statesIn(snapshot) {
  const found = []

  function visit(node) {
    const id = node.attributes?.id
    const states = node.attributes?.[STATES_ATTRIBUTE]

    if (id !== undefined && states !== undefined) {
      found.push(`#${id}(${states})`)
    }

    for (const child of node.childNodes ?? []) {
      visit(child)
    }
  }

  visit(JSON.parse(snapshot))

  return found.join(', ')
}

function expectStates(name, frames, expected) {
  const actual = frames.map((frame) => `${frame.kind}:${frame.label} [${statesIn(frame.snapshot)}]`)

  if (!isDeepStrictEqual(actual, expected)) {
    fail(name, `expected ${expected.join(' | ')}, got ${actual.join(' | ')}`)
  }

  pass(name)
}

/** A fresh page and a test that has begun, with its render frame held back. */
async function beginTest() {
  document.body.innerHTML = PAGE
  recorder.begin()
  await recorder.capture('render', RENDER_LABEL)

  return document.getElementById('save')
}

async function idle() {}

function failInteraction() {
  throw new Error(INTERACTION_ERROR)
}

/** Run `interaction`, which must reject with `INTERACTION_ERROR`. */
async function expectInteractionError(name, interaction) {
  let message

  try {
    await interaction()
  } catch (error) {
    message = errorMessage(error)
  }

  if (message !== INTERACTION_ERROR) {
    fail(name, message === undefined ? 'the interaction resolved' : `it threw "${message}"`)
  }
}

async function checkActionRenderFrame() {
  const name = 'recordAction: the render frame that hover() takes first does not show the hover'
  const save = await beginTest()
  await recordAction(HOVER, idle, { gesture: hoverGesture(save) })
  expectStates(name, recorder.end().frames, [RENDER_FRAME, `action:${HOVER} [#save(hover)]`])
}

async function checkActionThrows() {
  const name = 'recordAction: a click() that throws leaves the hover as it was'
  const save = await beginTest()
  await recordAction(HOVER, idle, { gesture: hoverGesture(save) })

  await expectInteractionError(name, () =>
    recordAction(CLICK, async () => failInteraction(), { gesture: POINTER_GESTURE }),
  )

  await recordAction(SHIFT, idle, { gesture: KEYBOARD_GESTURE })

  expectStates(name, recorder.end().frames, [
    RENDER_FRAME,
    `action:${HOVER} [#save(hover)]`,
    `action:${SHIFT} [#save(hover)]`,
  ])
}

// The click starts in the first test and resolves in the second, after its hover.
async function checkActionOutlivesTest() {
  const name = "recordAction: a click() that outlives its test leaves the next test's hover"
  let release
  const released = new Promise((resolve) => {
    release = resolve
  })

  await beginTest()
  const late = recordAction(CLICK, () => released, { gesture: POINTER_GESTURE })
  recorder.end()

  const save = await beginTest()
  await recordAction(HOVER, idle, { gesture: hoverGesture(save) })
  release()
  await late
  await recordAction(SHIFT, idle, { gesture: KEYBOARD_GESTURE })

  expectStates(name, recorder.end().frames, [
    RENDER_FRAME,
    `action:${HOVER} [#save(hover)]`,
    `action:${SHIFT} [#save(hover)]`,
  ])
}

async function checkActionNestedKeyboard() {
  const name = 'recordAction: keyboard() nested in copy() starts keyboard mode'
  const save = await beginTest()
  save.focus()
  await recordAction('copy()', () => recordAction(SHIFT, idle, { gesture: KEYBOARD_GESTURE }))

  expectStates(name, recorder.end().frames, [
    `render:${RENDER_LABEL} [#save(focus focus-within)]`,
    'action:copy() [#save(focus focus-visible focus-within)]',
  ])
}

async function checkActionNestedHover() {
  const name = 'recordAction: hover() around a nested pointer() notes the hover last'
  const save = await beginTest()

  await recordAction(HOVER, () => recordAction('pointer()', idle, { gesture: POINTER_GESTURE }), {
    gesture: hoverGesture(save),
  })

  expectStates(name, recorder.end().frames, [RENDER_FRAME, `action:${HOVER} [#save(hover)]`])
}

async function checkSyncRenderFrame() {
  const name =
    'recordSyncAction: the render frame that mouseEnter takes first does not show the hover'

  const save = await beginTest()
  recordSyncAction(MOUSE_ENTER, () => true, hoverGesture(save))
  expectStates(name, recorder.end().frames, [RENDER_FRAME, `action:${MOUSE_ENTER} [#save(hover)]`])
}

async function checkSyncThrows() {
  const name = 'recordSyncAction: a mouseLeave that throws leaves the hover as it was'
  const save = await beginTest()
  recordSyncAction(MOUSE_ENTER, () => true, hoverGesture(save))

  await expectInteractionError(name, async () =>
    recordSyncAction(MOUSE_LEAVE, failInteraction, UNHOVER_GESTURE),
  )

  recordSyncAction(CLICK, () => true)

  expectStates(name, recorder.end().frames, [
    RENDER_FRAME,
    `action:${MOUSE_ENTER} [#save(hover)]`,
    `action:${CLICK} [#save(hover)]`,
  ])
}

async function checkSyncNested() {
  const overName = 'recordSyncAction: mouseOver fired inside click notes the hover'
  const clicked = await beginTest()
  recordSyncAction(CLICK, () => recordSyncAction(MOUSE_OVER, () => true, hoverGesture(clicked)))
  expectStates(overName, recorder.end().frames, [RENDER_FRAME, `action:${CLICK} [#save(hover)]`])

  const lastName = 'recordSyncAction: mouseEnter around a nested mouseLeave notes the hover last'
  const entered = await beginTest()

  recordSyncAction(
    MOUSE_ENTER,
    () => recordSyncAction(MOUSE_LEAVE, () => true, UNHOVER_GESTURE),
    hoverGesture(entered),
  )

  expectStates(lastName, recorder.end().frames, [
    RENDER_FRAME,
    `action:${MOUSE_ENTER} [#save(hover)]`,
  ])
}

// Lazy render frames, so that each first interaction takes the render frame before it runs.
async function checkGestures() {
  const removeDom = installDom()
  recorder.configure({ environment: 'dom', renderFrame: 'lazy' })

  try {
    await checkActionRenderFrame()
    await checkActionThrows()
    await checkActionOutlivesTest()
    await checkActionNestedKeyboard()
    await checkActionNestedHover()
    await checkSyncRenderFrame()
    await checkSyncThrows()
    await checkSyncNested()
  } finally {
    recorder.configure({})
    removeDom()
  }
}

checkDedupe()
checkUnfilledAndReopened()
checkInputUntouched()
checkFieldsCarryOver()
checkAccepted()
checkRejected()
await checkRejectedSelector()
await checkGestures()
