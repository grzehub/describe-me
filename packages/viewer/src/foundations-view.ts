import type { FoundationGroup } from '@describe-me/core/types'
import { BackgroundSwitch } from './background-switch.js'
import type { FoundationsModel } from './build-foundations-model.js'
import type { Canvas } from './canvas-of.js'
import { el } from './el.js'
import { foundationsModelOf } from './foundations-model-of.js'
import { foundationsRetry } from './foundations-retry.js'
import type { FoundationsLoad } from './load-foundations.js'
import { loadFoundations } from './load-foundations.js'
import type { StageBackground } from './parse-stage-background.js'
import { buildSpecimenFrame } from './specimen-frame.js'
import { openFoundations, state, writeHash } from './state.js'
import { systemName } from './system-name.js'
import { testView } from './test-view.js'

/** There is no frame to read `auto` from, so it is light. */
const CANVASES: Record<StageBackground, Canvas> = {
  auto: 'light',
  light: 'light',
  dark: 'dark',
  transparent: 'transparent',
}

const START_HEIGHT = 160

interface Panel {
  generatedAt: string
  load: FoundationsLoad
  model: FoundationsModel | null
  main: HTMLElement
  buttons: Map<FoundationGroup, HTMLElement>
  backgrounds: BackgroundSwitch
  hint: HTMLElement
  canvas: HTMLElement
  /** The section and background the frame on the canvas shows. */
  frame: { section: FoundationGroup; background: StageBackground } | null
}

let panel: Panel | null = null

/** The systems with their versions once the file is in, else the manifest's names. */
function metaText(load: FoundationsLoad): string {
  const names =
    load.status === 'ready'
      ? load.file.systems.map((system) =>
          [systemName(system.id), system.version].filter(Boolean).join(' '),
        )
      : (state.manifest?.foundations?.systems ?? []).map((id) => systemName(id))

  return names.length > 0 ? names.join(' · ') : 'custom properties'
}

function statusText(load: FoundationsLoad, model: FoundationsModel | null): string | null {
  if (load.status === 'loading') {
    return 'loading foundations…'
  }

  if (load.status === 'error') {
    return load.message
  }

  return model?.sections.length ? null : 'no tokens to show'
}

function sectionButtons(model: FoundationsModel | null): Map<FoundationGroup, HTMLElement> {
  const buttons = new Map<FoundationGroup, HTMLElement>()

  for (const section of model?.sections ?? []) {
    const button = el(
      'button',
      {
        type: 'button',
        'data-section': section.id,
        click: () => openFoundations(section.id, 'replace'),
      },
      section.title,
      el('span', { class: 'count' }, String(section.count)),
    )

    buttons.set(section.id, button)
  }

  return buttons
}

function incompleteNote(load: FoundationsLoad): HTMLElement | null {
  if (load.status !== 'ready' || load.incomplete === 0) {
    return null
  }

  const text =
    load.incomplete === 1
      ? '1 stylesheet did not load completely'
      : `${load.incomplete} stylesheets did not load completely`

  return el('div', { class: 'foundations-note', role: 'status' }, text)
}

function buildPanel(generatedAt: string, load: FoundationsLoad): Panel {
  const model = load.status === 'ready' ? foundationsModelOf(load) : null
  const buttons = sectionButtons(model)
  const backgrounds = new BackgroundSwitch()
  const hint = el('div', { class: 'foundations-hint', hidden: true }, 'no dark variant found')
  const canvas = el('div', { class: 'foundations-canvas' })
  const status = statusText(load, model)

  if (status !== null) {
    canvas.append(el('div', { class: 'empty' }, status))
  }

  const sections = el('div', {
    class: 'foundations-sections',
    role: 'group',
    'aria-label': 'Foundations sections',
  })

  sections.append(...buttons.values())

  const main = el(
    'main',
    { class: 'foundations' },
    el(
      'div',
      { class: 'overview-head foundations-head' },
      el('h1', {}, 'Foundations'),
      el('div', { class: 'overview-meta' }, metaText(load)),
    ),
    el('div', { class: 'foundations-toolbar' }, sections, backgrounds.element),
    hint,
    incompleteNote(load),
    canvas,
  )

  return { generatedAt, load, model, main, buttons, backgrounds, hint, canvas, frame: null }
}

/** A link to an empty or unknown section shows the first one with tokens. */
function correctSection(model: FoundationsModel | null): void {
  const first = model?.sections[0]

  if (!first || model.sections.some((section) => section.id === state.foundations)) {
    return
  }

  state.foundations = first.id
  writeHash('replace')
}

/** Synced in place, so a focused button keeps its focus. */
function syncChrome(shown: Panel): void {
  for (const [id, button] of shown.buttons) {
    button.setAttribute('aria-pressed', String(id === state.foundations))
  }

  shown.backgrounds.sync()

  const model = shown.model
  const plain = model !== null && !model.darkVariant && !model.tokenModes
  shown.hint.hidden = !(state.background === 'dark' && plain)
  shown.canvas.dataset.canvas = CANVASES[state.background]
}

/** Only a section or background change rebuilds the frame, and the panel keeps its scroll otherwise. */
function syncFrame(shown: Panel): void {
  const section = shown.model?.sections.find((candidate) => candidate.id === state.foundations)

  if (shown.load.status !== 'ready' || !section) {
    return
  }

  const background = state.background
  const frame = shown.frame

  if (frame?.section === section.id && frame.background === background) {
    return
  }

  const old = shown.canvas.querySelector('iframe')
  const height = old ? old.getBoundingClientRect().height : START_HEIGHT
  old?.remove()

  buildSpecimenFrame(shown.canvas, {
    section,
    dark: background === 'dark',
    variant: shown.model?.darkVariant ?? null,
    css: shown.load.css,
    height: height || START_HEIGHT,
  })

  if (frame && frame.section !== section.id) {
    shown.main.scrollTop = 0
  }

  shown.frame = { section: section.id, background }
}

/** The panel stays while the manifest and the load stay, and while it is on screen. */
function currentPanel(): Panel {
  const retry = foundationsRetry.requested
  foundationsRetry.requested = false

  const load = loadFoundations(retry)
  const generatedAt = state.manifest?.generatedAt ?? ''
  const kept = panel?.generatedAt === generatedAt && panel.load === load && panel.main.isConnected

  if (panel && kept) {
    return panel
  }

  const old = panel?.main
  panel = buildPanel(generatedAt, load)

  if (old?.isConnected) {
    old.replaceWith(panel.main)
  }

  return panel
}

/**
 * Show Foundations in the center: the systems, a button per section with its
 * count, the stage background switch and one specimen frame for the open
 * section. A panel already in the center is never appended again, because a
 * moved iframe reloads blank.
 */
export function showFoundations(center: HTMLElement): void {
  const shown = currentPanel()

  if (shown.main.parentElement !== center) {
    if (testView().main.isConnected) {
      center.append(shown.main)
    } else {
      // The first paint, which also clears the startup error message.
      center.replaceChildren(shown.main)
    }
  }

  correctSection(shown.model)
  syncChrome(shown)
  syncFrame(shown)
}
