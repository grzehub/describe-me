import type { Foundations } from '@describe-me/core/types'
import type { FoundationsModel } from './build-foundations-model.js'
import { el } from './el.js'
import { foundationsModelOf } from './foundations-model-of.js'
import { loadFoundations } from './load-foundations.js'
import { systemName } from './system-name.js'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function systemsText(file: Foundations): string | null {
  const names = file.systems.map((system) => {
    const name = [systemName(system.id), system.version].filter(Boolean).join(' ')
    const shadcn = system.id === 'shadcn' ? file.shadcn : undefined
    const details = [shadcn?.style, shadcn?.baseColor].filter(Boolean)

    return details.length > 0 ? `${name} (${details.join(', ')})` : name
  })

  return names.length > 0 ? names.join(', ') : null
}

function sheetsText(file: Foundations): string | null {
  const parts = [
    file.tokenSheets.length > 0 ? plural(file.tokenSheets.length, 'token sheet') : null,
    file.fontSheets.length > 0 ? plural(file.fontSheets.length, 'font sheet') : null,
  ].filter((part) => part !== null)

  return parts.length > 0 ? parts.join(', ') : null
}

function darkText(model: FoundationsModel): string {
  const variant = model.darkVariant
  const attribute = variant?.attribute
  const parts = [
    variant?.className ? `class .${variant.className}` : null,
    attribute ? `attribute [${attribute.name}="${attribute.value}"]` : null,
    variant?.media ? 'prefers-color-scheme' : null,
    model.tokenModes ? 'theme modes' : null,
  ].filter((part) => part !== null)

  return parts.length > 0 ? parts.join(', ') : 'none'
}

function rowsOf(file: Foundations, model: FoundationsModel): [string, string | null][] {
  const theme = file.theme

  return [
    ['systems', systemsText(file)],
    ['Tailwind entry', file.tailwind?.entry ?? null],
    ['theme module', theme ? `${theme.module}#${theme.export} (${theme.adapter})` : null],
    ['stylesheets', sheetsText(file)],
    ['dark variant', darkText(model)],
    ['collected', `in ${file.duration} ms`],
  ]
}

/**
 * The inspector's sections while Foundations is open: where the tokens come
 * from, the dark variant, how long collecting took, and the problems.
 */
export function renderFoundationsInspector(): HTMLElement[] {
  const load = loadFoundations()
  const section = el('section', {}, el('h3', {}, 'foundations'))

  if (load.status !== 'ready') {
    const text =
      load.status === 'loading' ? 'loading foundations…' : 'foundations.json did not load'

    section.append(el('div', { class: 'hint' }, text))

    return [section]
  }

  const table = el('table', { class: 'kv' })

  for (const [key, value] of rowsOf(load.file, foundationsModelOf(load))) {
    if (value !== null) {
      table.append(el('tr', {}, el('td', {}, key), el('td', {}, value)))
    }
  }

  section.append(table)

  if (load.file.errors.length === 0) {
    return [section]
  }

  const errors = el('section', {}, el('h3', {}, 'errors'))
  errors.append(...load.file.errors.map((error) => el('pre', { class: 'err' }, error)))

  return [section, errors]
}
