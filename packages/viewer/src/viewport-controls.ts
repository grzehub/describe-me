import { el } from './el.js'
import { MIN_FRAME_HEIGHT } from './min-frame-height.js'
import { parseViewportSize } from './parse-viewport-size.js'
import { rerender } from './rerender.js'
import { state, writeHash } from './state.js'

const PRESETS: { label: string; width: number | null }[] = [
  { label: '100%', width: null },
  { label: '768px', width: 768 },
  { label: '375px', width: 375 },
]

interface Controls {
  tools: HTMLElement
  presets: Map<number | null, HTMLElement>
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
  const tools = el('div', { class: 'tools' })

  for (const preset of PRESETS) {
    const button = el(
      'button',
      { click: () => setViewport(preset.width, state.viewport.height) },
      preset.label,
    )

    presets.set(preset.width, button)
    tools.append(button)
  }

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

  return { tools, presets, width, height, zoom }
}

/** The field being typed in keeps what the user typed. */
function mirror(input: HTMLInputElement, size: number | null): void {
  if (document.activeElement !== input) {
    input.value = sizeText(size)
  }
}

/**
 * The viewport toolbar: width presets, width and height fields and the zoom.
 * Built once and synced in place on every call, so a focused field keeps its focus.
 */
export function renderViewportControls(): HTMLElement {
  controls ??= build()

  for (const [width, button] of controls.presets) {
    button.classList.toggle('on', width === state.viewport.width)
  }

  mirror(controls.width, state.viewport.width)
  mirror(controls.height, state.viewport.height)
  controls.zoom.textContent = state.scale === 1 ? '' : `${Math.round(state.scale * 100)}%`

  return controls.tools
}
