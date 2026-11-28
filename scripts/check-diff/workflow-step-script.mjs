import { readFileSync } from 'node:fs'

function indentOf(line) {
  return line.length - line.trimStart().length
}

function dedented(lines) {
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== '').map((line) => indentOf(line)),
  )

  return lines.map((line) => line.slice(indent))
}

/**
 * The `run: |` text of the workflow step named `name`, without its
 * indentation, so a check can run the step as the runner does. It reads the
 * layout of this repository's workflows, where a step starts with
 * `- name:` and `run: |` is a key of that step, which avoids a YAML parser.
 */
export function workflowStepScript(file, name) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`)

  if (start < 0) {
    throw new Error(`${file} has no step named "${name}"`)
  }

  const keyIndent = indentOf(lines[start]) + 2

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() !== '' && indentOf(line) < keyIndent) {
      break
    }

    if (indentOf(line) !== keyIndent || line.trim() !== 'run: |') {
      continue
    }

    const body = []

    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '' && indentOf(lines[j]) <= keyIndent) {
        break
      }

      body.push(lines[j])
    }

    while (body.length > 0 && body.at(-1).trim() === '') {
      body.pop()
    }

    return `${dedented(body).join('\n')}\n`
  }

  throw new Error(`the step "${name}" of ${file} has no run: | block`)
}
