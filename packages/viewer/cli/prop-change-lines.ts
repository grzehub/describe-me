import type { ComponentChange, PropChange, PropSide } from './changes-report.js'
import type { TextFormat } from './text-format.js'

function addedText(name: string, side: PropSide, format: TextFormat): string {
  let text = `${name} added, of type ${format.code(side.type)}`

  if (side.required) {
    text += ', required'
  }

  if (side.defaultValue !== undefined) {
    text += `, default ${format.code(side.defaultValue)}`
  }

  return text
}

function defaultText(name: string, base: PropSide, head: PropSide, format: TextFormat): string {
  if (base.defaultValue === undefined) {
    return `${name} got the default ${format.code(String(head.defaultValue))}`
  }

  if (head.defaultValue === undefined) {
    return `${name} lost its default ${format.code(base.defaultValue)}`
  }

  return (
    `default of ${name} changed from ${format.code(base.defaultValue)} ` +
    `to ${format.code(head.defaultValue)}`
  )
}

/** One text per difference of a changed prop: its type, whether it is required, its default. */
function changedTexts(name: string, base: PropSide, head: PropSide, format: TextFormat): string[] {
  const texts: string[] = []

  if (base.type !== head.type) {
    texts.push(
      `type of ${name} changed from ${format.code(base.type)} to ${format.code(head.type)}`,
    )
  }

  if (base.required !== head.required) {
    texts.push(`${name} now ${head.required ? 'required' : 'optional'}`)
  }

  if (base.defaultValue !== head.defaultValue) {
    texts.push(defaultText(name, base, head, format))
  }

  return texts
}

function propTexts(prop: PropChange, format: TextFormat): string[] {
  const name = format.code(prop.name)

  if (prop.change === 'added' && prop.head !== undefined) {
    return [addedText(name, prop.head, format)]
  }

  if (prop.change === 'changed' && prop.base !== undefined && prop.head !== undefined) {
    return changedTexts(name, prop.base, prop.head, format)
  }

  return [`${name} removed`]
}

/**
 * One line per difference in a component's props, such as
 * ``Divider: default of `orientation` changed from `'horizontal'` to `'vertical'` ``.
 */
export function propChangeLines(component: ComponentChange, format: TextFormat): string[] {
  const name = format.word(component.name)

  return component.props.flatMap((prop) =>
    propTexts(prop, format).map((text) => `${name}: ${text}`),
  )
}
