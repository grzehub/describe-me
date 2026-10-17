import { el } from './el.js'
import { liveSession } from './live-session.js'
import { liveShown } from './live-shown.js'
import { MIN_FRAME_HEIGHT } from './min-frame-height.js'
import type { StageBackground } from './parse-stage-background.js'
import { parseViewportSize } from './parse-viewport-size.js'
import { rerender } from './rerender.js'
import { state, writeHash } from './state.js'
import { toggleLive } from './toggle-live.js'

const PRESETS: { label: string; width: number | null }[] = [
  { label: '100%', width: null },
  { label: '768px', width: 768 },
  { label: '375px', width: 375 },
]

/** Swatches, not words, so the breadcrumb path keeps its room. */
const BACKGROUNDS: { value: StageBackground; title: string }[] = [
  { value: 'auto', title: 'Stage background: auto, follows the page' },
  { value: 'light', title: 'Stage background: light' },
  { value: 'dark', title: 'Stage background: dark' },
  { value: 'transparent', title: 'Stage background: transparent' },
]

interface Controls {
  tools: HTMLElement
  live: HTMLElement
  presets: Map<number | null, HTMLElement>
  backgrounds: Map<StageBackground, HTMLElement>
  width: HTMLInputElement
  height: HTMLInputElement
  zoom: HTMLElement
}

let controls: Controls | null = null

function setViewport(width: number | null, height: number | null): void {
  state.viewport = { width, height }
  writeHash('replace')
  rerender('frame')
}

function setBackground(background: StageBackground): void {
  state.background = background
  writeHash('replace')
  rerender('frame')
}

function sizeText(size: number | null): string {
  return size === null ? '' : String(size)
}

function sizeInput(
  label: string,
  minimum: number,
  onSize: (size: number | null) => void,
): HTMLInputElement {
  const input = el('input', {
    type: 'number',
    placeholder: 'auto',
    min: String(minimum),
    max: '10000',
    'aria-label': label,
    change: () => {
      const size = parseViewportSize(input.value, minimum)
      onSize(size)
      // The focused field shows the size in use, so a raised or rejected value does not linger.
      input.value = sizeText(size)
    },
  })

  return input
}

function build(): Controls {
  const presets = new Map<number | null, HTMLElement>()
  const live = el('button', { class: 'live-toggle', type: 'button', click: toggleLive }, 'Live')
  const tools = el('div', { class: 'tools' }, live)

  for (const preset of PRESETS) {
    const button = el(
      'button',
      { click: () => setViewport(preset.width, state.viewport.height) },
      preset.label,
    )

    presets.set(preset.width, button)
    tools.append(button)
  }

  const backgrounds = new Map<StageBackground, HTMLElement>()
  const group = el('div', { class: 'backgrounds', role: 'group', 'aria-label': 'Stage background' })

  for (const background of BACKGROUNDS) {
    const button = el('button', {
      type: 'button',
      'data-bg': background.value,
      'aria-label': background.value,
      title: background.title,
      click: () => setBackground(background.value),
    })

    backgrounds.set(background.value, button)
    group.append(button)
  }

  tools.append(group)

  const width = sizeInput('viewport width', 1, (size) => setViewport(size, state.viewport.height))
  const height = sizeInput('viewport height', MIN_FRAME_HEIGHT, (size) =>
    setViewport(state.viewport.width, size),
  )

  const zoom = el('span', { class: 'zoom', title: 'scaled to fit the stage' })

  tools.append(
    el('label', { class: 'size' }, 'W', width),
    el('label', { class: 'size' }, 'H', height),
    zoom,
  )

  return { tools, live, presets, backgrounds, width, height, zoom }
}

/**
 * Hidden while the preview is off. While it starts or after it failed, the
 * title says why the toggle does nothing. `aria-disabled` rather than
 * `disabled`, so every browser shows that title.
 */
function syncLiveToggle(button: HTMLElement): void {
  const { preview } = state
  const shown = liveShown()
  const titles: Record<typeof preview.status, string> = {
    ready: 'Mount the test live (L)',
    starting: 'The live preview is starting',
    error: preview.error ?? '',
    off: '',
  }

  button.hidden = preview.status === 'off'
  button.title = titles[preview.status]
  button.classList.toggle('on', shown)
  button.classList.toggle('loading', shown && liveSession.status === 'loading')
  button.setAttribute('aria-pressed', String(shown))

  if (preview.status === 'ready') {
    button.removeAttribute('aria-disabled')
  } else {
    button.setAttribute('aria-disabled', 'true')
  }
}

/** The field being typed in keeps what the user typed. */
function mirror(input: HTMLInputElement, size: number | null): void {
  if (document.activeElement !== input) {
    input.value = sizeText(size)
  }
}

/**
 * The viewport toolbar: the Live toggle, width presets, the stage background
 * switch, width and height fields and the zoom. Built once and synced in place
 * on every call, so a focused field keeps its focus.
 */
export function renderViewportControls(): HTMLElement {
  controls ??= build()
  syncLiveToggle(controls.live)

  for (const [width, button] of controls.presets) {
    button.classList.toggle('on', width === state.viewport.width)
  }

  for (const [background, button] of controls.backgrounds) {
    const on = background === state.background
    button.classList.toggle('on', on)
    button.setAttribute('aria-pressed', String(on))
  }

  mirror(controls.width, state.viewport.width)
  mirror(controls.height, state.viewport.height)
  controls.zoom.textContent = state.scale === 1 ? '' : `${Math.round(state.scale * 100)}%`

  return controls.tools
}
