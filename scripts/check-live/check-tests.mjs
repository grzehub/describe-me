/**
 * What both parts of `check-live` check on every example: each test of the
 * manifest mounts, with the behaviours of some, and each page of the status
 * table reports its status. The dev part runs them against the live server,
 * the static part against a build served under a nested path.
 */
import {
  checkMount,
  checkQuiet,
  delay,
  expectVisible,
  FIRST_STATUS_TIMEOUT,
  manifestTests,
  show,
  STATUS_TIMEOUT,
  waitForMessage,
} from './live-frame.mjs'

// `ink` of examples/react-jsdom/src/theme.ts.
const THEME_INK = 'rgb(17, 17, 17)'

async function selectsRename({ page, frame }) {
  await frame.getByRole('button', { name: 'Actions' }).click()
  await frame.getByRole('menuitem', { name: 'Rename' }).click()

  const action = await waitForMessage(page, (message) => message.type === 'action', 5_000)
  const shown = JSON.stringify(action && { name: action.name, args: action.args })
  const expected = JSON.stringify({ name: 'onSelect', args: ['"Rename"'] })
  const problems = shown === expected ? [] : [`expected the action ${expected}, got ${shown}`]

  return [
    ...problems,
    ...(await expectVisible(frame.getByText('selected: Rename'), '"selected: Rename"', 5_000)),
  ]
}

async function hidesInRealTime({ frame, mountedAt }) {
  const saved = frame.getByText('Saved')
  const shown = await expectVisible(saved, '"Saved"', 2_000)

  if (shown.length > 0) {
    return shown
  }

  await delay(Math.max(0, mountedAt + 2_000 - Date.now()))

  if (!(await saved.isVisible())) {
    return ['"Saved" was gone before 2 s, so time is not real or the timer is too short']
  }

  try {
    await saved.waitFor({ state: 'hidden', timeout: Math.max(1, mountedAt + 5_000 - Date.now()) })

    return []
  } catch {
    return ['"Saved" was still there 5 s after the mount']
  }
}

async function takesTheTheme({ frame }) {
  const heading = frame.locator('h2')
  const shown = await expectVisible(heading, 'the heading', 5_000)

  if (shown.length > 0) {
    return shown
  }

  const globalStyles = await frame
    .locator('body')
    .evaluate((body) => getComputedStyle(body).getPropertyValue('--global-styles').trim())

  const colour = await heading.evaluate((element) => getComputedStyle(element).color)
  const problems = []

  if (globalStyles !== 'applied') {
    problems.push(`body has --global-styles: ${JSON.stringify(globalStyles)}, expected "applied"`)
  }

  if (colour !== THEME_INK) {
    problems.push(`the h2 colour is ${colour}, expected ${THEME_INK} from the theme`)
  }

  return problems
}

/** What a live component must do after it mounted, by example and full test name. */
export const BEHAVIOURS = {
  'react-browser': {
    'Menu > selects an item and reports it': selectsRename,
    'Naming > names Button variant=ghost after a rerender from an empty fragment': ({ frame }) =>
      expectVisible(frame.getByRole('button', { name: 'Skip for now' }), '"Skip for now"', 5_000),
  },
  'react-jsdom': {
    'Naming > names Badge tone=danger after a rerender from an empty fragment': ({ frame }) =>
      expectVisible(frame.getByText('blocked'), '"blocked"', 5_000),
    'Toast > hides itself after its duration': hidesInRealTime,
    'AsyncGreeting > greets once loaded': ({ frame }) =>
      expectVisible(frame.getByText('Hello, Ada'), '"Hello, Ada"', 5_000),
    'Heading > takes its colour from the theme': takesTheTheme,
  },
}

const USED = ['Menu', 'selects an item and reports it']

// The URL parser drops tabs and newlines, so each of these would become `//other.test/x.js`.
const OTHER_ORIGIN = ['\t', '\n', '\r'].map((control) => ({
  file: `${control}/other.test/x.js`,
  path: USED,
  status: 'not-found',
}))

/** Pages that must report a status other than `mounted`, and show it in `body`. */
export const STATUSES = {
  'react-browser': [
    { file: 'src/Menu.test.tsx', path: ['Menu', 'no such test'], status: 'not-found' },
    { file: '../src/Menu.test.tsx', path: USED, status: 'not-found' },
    { file: 'src/missing.test.tsx', path: USED, status: 'import-failed' },
    ...OTHER_ORIGIN,
  ],
  'react-jsdom': [
    {
      file: 'src/use-toggle.test.tsx',
      path: ['useToggle', 'flips its value'],
      status: 'no-render',
    },
    // plugin-react adds a self-import to a file with a component. A second copy of the
    // file would register this test twice, and its second occurrence would mount.
    {
      file: 'src/Naming.test.tsx',
      path: ['Naming', 'names Badge tone=danger inside a ThemeProvider'],
      occurrence: 2,
      status: 'not-found',
    },
  ],
}

async function checkStatus(context, expected) {
  const label = `${context.name} file=${JSON.stringify(expected.file)}`
  const status = await show(context, expected, STATUS_TIMEOUT)

  if (status?.status !== expected.status) {
    return [`${label}: expected ${expected.status}, got ${status?.status ?? 'no status'}`]
  }

  const text = await context.frame.locator('body').innerText()

  return text.includes(expected.status)
    ? []
    : [`${label}: the page does not show ${expected.status}`]
}

/** Shows every test of the manifest, then runs the behaviour of those that have one. */
export async function checkTests(context, manifest) {
  const result = { problems: [], mounted: 0, behaviours: 0 }

  for (const [index, test] of manifestTests(manifest).entries()) {
    const label = `${context.name} ${test.file} ${test.fullName}`
    const timeout = index === 0 ? FIRST_STATUS_TIMEOUT : STATUS_TIMEOUT
    const mount = await checkMount(context, test, timeout)
    const behaviour = BEHAVIOURS[context.name]?.[test.fullName]

    result.problems.push(...mount.problems)

    if (mount.problems.length === 0) {
      result.mounted += 1
    }

    if (behaviour !== undefined && mount.problems.length === 0) {
      const behaved = await behaviour({ ...context, mountedAt: mount.mountedAt })

      result.problems.push(...behaved.map((problem) => `${label}: ${problem}`))
      result.behaviours += behaved.length === 0 ? 1 : 0
    }

    result.problems.push(...(await checkQuiet(context, label)))
  }

  return result
}

/** Shows each page that must report a status other than `mounted`. */
export async function checkStatuses(context) {
  const result = { problems: [], passed: 0 }

  for (const expected of STATUSES[context.name] ?? []) {
    const problems = await checkStatus(context, expected)

    result.problems.push(...problems)
    result.passed += problems.length === 0 ? 1 : 0
  }

  return result
}
