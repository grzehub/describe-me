import { el } from './el.js'

type Theme = 'system' | 'light' | 'dark'

// index.html reads the same key before the first paint.
const STORAGE_KEY = 'describe-me:theme'

const THEMES: { value: Theme; title: string }[] = [
  { value: 'system', title: 'Viewer theme: system, follows your system' },
  { value: 'light', title: 'Viewer theme: light' },
  { value: 'dark', title: 'Viewer theme: dark' },
]

let group: HTMLElement | null = null

function applyTheme(theme: Theme): void {
  const root = document.documentElement

  if (theme === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }

  try {
    if (theme === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, theme)
    }
  } catch {
    // Private mode or a sandbox: the theme lasts until a reload.
  }
}

/** What index.html applied from storage, the only source at startup. */
function startTheme(): Theme {
  const theme = document.documentElement.dataset.theme

  return theme === 'light' || theme === 'dark' ? theme : 'system'
}

function press(buttons: Map<Theme, HTMLElement>, theme: Theme): void {
  for (const [value, button] of buttons) {
    const on = value === theme
    button.classList.toggle('on', on)
    button.setAttribute('aria-pressed', String(on))
  }
}

function build(): HTMLElement {
  const buttons = new Map<Theme, HTMLElement>()
  const switcher = el('div', { class: 'theme-switch', role: 'group', 'aria-label': 'Viewer theme' })

  for (const theme of THEMES) {
    const button = el('button', {
      type: 'button',
      'aria-label': theme.value,
      'data-option': theme.value,
      title: theme.title,
      click: () => {
        applyTheme(theme.value)
        press(buttons, theme.value)
      },
    })

    buttons.set(theme.value, button)
    switcher.append(button)
  }

  press(buttons, startTheme())

  return switcher
}

/**
 * The viewer's theme switch at the right end of the header: system, light or
 * dark. Built once and never repainted, so a focused button keeps its focus.
 */
export function renderThemeSwitch(): HTMLElement {
  group ??= build()

  return group
}
