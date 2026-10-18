import type { Foundations } from '@describe-me/core/types'
import { STYLE_URL_PREFIX } from '@describe-me/core/types'
import { foundationsShown } from './foundations-shown.js'
import { loadStyle } from './load-style.js'
import { rerender } from './rerender.js'
import { resolveAssetUrls } from './resolve-asset-urls.js'
import { state } from './state.js'
import { testShown } from './test-shown.js'

/** What the view has of `foundations.json` and its stylesheets. */
export type FoundationsLoad =
  | {
      status: 'loading'
      /** Resolves with the finished load once the memo holds it. */
      settled: Promise<FoundationsLoad>
    }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      file: Foundations
      /** The token sheets' CSS, in file order. */
      tokenCss: string[]
      /** Every distinct sheet's CSS, token sheets first, then font sheets. */
      css: string[]
      /** Sheets with a chunk that did not load. */
      incomplete: number
    }

type Loaded = { css: string; complete: boolean }

type Memo = { generatedAt: string; result: FoundationsLoad }

let memo: Memo | null = null

function loadSheet(cssText: string): Promise<Loaded> {
  if (cssText.startsWith(STYLE_URL_PREFIX)) {
    return loadStyle(cssText.slice(STYLE_URL_PREFIX.length))
  }

  return Promise.resolve({ css: resolveAssetUrls(cssText), complete: true })
}

function isFoundations(value: unknown): value is Foundations {
  const file = value as Partial<Foundations> | null

  return (
    typeof file === 'object' &&
    file !== null &&
    Array.isArray(file.tokens) &&
    Array.isArray(file.tokenSheets) &&
    Array.isArray(file.fontSheets) &&
    Array.isArray(file.systems) &&
    Array.isArray(file.errors)
  )
}

async function fetchFile(): Promise<Foundations | string> {
  let response: Response

  try {
    response = await fetch('__data/foundations.json', { cache: 'no-store' })
  } catch {
    return 'foundations.json did not load, because the request failed.'
  }

  if (!response.ok) {
    return `foundations.json did not load (HTTP ${response.status}).`
  }

  let file: unknown

  try {
    file = await response.json()
  } catch {
    return 'foundations.json is not valid JSON.'
  }

  const version = (file as { version?: unknown } | null)?.version

  if (version !== 1) {
    return `foundations.json has version ${String(version)}, and this viewer reads only version 1.`
  }

  return isFoundations(file) ? file : 'foundations.json lacks the lists this viewer reads.'
}

async function load(): Promise<FoundationsLoad> {
  const file = await fetchFile()

  if (typeof file === 'string') {
    return { status: 'error', message: file }
  }

  // shadcn's src/index.css is both a token sheet and a font sheet.
  const distinct = [
    ...new Set([...file.tokenSheets, ...file.fontSheets].map((sheet) => sheet.cssText)),
  ]

  const loaded = await Promise.all(distinct.map((cssText) => loadSheet(cssText)))
  const byText = new Map(distinct.map((cssText, i) => [cssText, loaded[i]?.css ?? '']))

  return {
    status: 'ready',
    file,
    tokenCss: file.tokenSheets.map((sheet) => byText.get(sheet.cssText) ?? ''),
    css: loaded.map((sheet) => sheet.css),
    incomplete: loaded.filter((sheet) => !sheet.complete).length,
  }
}

/** The stage's dark variant comes from the load too, so a test under `bg=dark` repaints its frame. */
function repaint(): void {
  if (foundationsShown()) {
    rerender()
  } else if (state.background === 'dark' && testShown()) {
    rerender('frame')
  }
}

/**
 * `foundations.json` and its stylesheets for the manifest on screen, loaded on
 * the first call and memoized until the next manifest. Never rejects. When the
 * load settles, the viewer repaints while Foundations is open, and repaints
 * the frame while a test shows under `bg=dark`. With `retry`, a load that
 * failed starts again.
 */
export function loadFoundations(retry = false): FoundationsLoad {
  const generatedAt = state.manifest?.generatedAt ?? ''

  if (memo?.generatedAt === generatedAt && !(retry && memo.result.status === 'error')) {
    return memo.result
  }

  // `settled` resolves after the memo holds the result, so whoever awaits it
  // reads the finished load from here.
  const settled: Promise<FoundationsLoad> = load()
    .catch((error: unknown) => ({
      status: 'error' as const,
      message: `foundations.json did not load (${error instanceof Error ? error.message : String(error)}).`,
    }))
    .then((result) => {
      // A new manifest replaced the memo, and its own load repaints.
      if (memo === current) {
        current.result = result
        repaint()
      }

      return result
    })

  const current: Memo = { generatedAt, result: { status: 'loading', settled } }
  memo = current

  return current.result
}
