const STACK_LINES = 4

/** An error's message and the first lines of its stack, for the detail of a status. */
export function liveErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  const heading = String(error)
  const stack = error.stack ?? ''
  // V8 starts the stack with the heading. Firefox and Safari do not.
  const frames = (stack.startsWith(heading) ? stack.slice(heading.length) : stack)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, STACK_LINES)

  return [heading, ...frames].join('\n')
}
