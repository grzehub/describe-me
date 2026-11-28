import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The part of Playwright's `chromium` that `diff --shots` uses. Declared here,
 * because `describe-me` does not depend on Playwright.
 */
export interface ShotBrowserType {
  launch(): Promise<ShotBrowser>
}

/** A launched Chromium. */
export interface ShotBrowser {
  newContext(options: {
    viewport: { width: number; height: number }
    deviceScaleFactor: number
    colorScheme: 'light'
  }): Promise<ShotContext>
  close(): Promise<void>
}

/** One browser context, whose pages share a viewport, a pixel density and a scheme. */
export interface ShotContext {
  newPage(): Promise<ShotPage>
  close(): Promise<void>
}

/** A page as `--shots` drives it. */
export interface ShotPage {
  goto(url: string, options: { waitUntil: 'commit'; timeout: number }): Promise<unknown>
  waitForFunction(
    expression: string,
    arg: undefined,
    options: { timeout: number },
  ): Promise<unknown>
  evaluate<Result, Arg>(
    pageFunction: (arg: Arg) => Result | Promise<Result>,
    arg: Arg,
  ): Promise<Result>
  setViewportSize(size: { width: number; height: number }): Promise<void>
  screenshot(options: {
    clip: { x: number; y: number; width: number; height: number }
    animations: 'disabled'
    caret: 'hide'
  }): Promise<Buffer>
  close(): Promise<void>
}

function notFound(root: string): Error {
  return new Error(
    `--shots needs Playwright, and cannot find it from ${root}. Run npm install -D playwright and npx playwright install chromium in the project, or pass --root with a project that has it.`,
  )
}

/** Whether `node_modules/playwright` is in `root` or a directory above it. */
function isInstalledFrom(root: string): boolean {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', 'playwright', 'package.json'))) {
      return true
    }

    if (dirname(dir) === dir) {
      return false
    }
  }
}

function browserTypeOf(exported: unknown): ShotBrowserType | undefined {
  const loaded = exported as { chromium?: unknown; default?: { chromium?: unknown } } | null
  // Imported from ESM, Playwright's CommonJS entry has `chromium` only on its default export.
  const chromium = loaded?.chromium ?? loaded?.default?.chromium
  const launch = (chromium as { launch?: unknown } | undefined)?.launch

  return typeof launch === 'function' ? (chromium as ShotBrowserType) : undefined
}

/**
 * `chromium` from the project's own Playwright, never from a copy next to
 * `describe-me`. Throws with the install commands when the project has none.
 */
export async function importPlaywright(root: string): Promise<ShotBrowserType> {
  // The bin shims of package managers put their own store on NODE_PATH, which
  // `resolve()` searches too. Only the project's own node_modules count.
  if (!isInstalledFrom(root)) {
    throw notFound(root)
  }

  let entry: string

  try {
    entry = createRequire(join(root, 'package.json')).resolve('playwright')
  } catch {
    throw notFound(root)
  }

  const chromium = browserTypeOf(await import(pathToFileURL(entry).href))

  if (chromium === undefined) {
    throw notFound(root)
  }

  return chromium
}
