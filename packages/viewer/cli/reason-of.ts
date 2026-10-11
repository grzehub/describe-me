const PREFIX = 'describe-me: '
// Vite and its bundler colour their errors for the terminal.
const COLOURS = new RegExp(String.raw`\u001b\[[\d;]*m`, 'g')

/**
 * The message of an error as the CLI prints it after its own
 * `describe-me: `: without colours, and without a prefix of its own.
 */
export function reasonOf(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(COLOURS, '')
    .trim()

  return message.startsWith(PREFIX) ? message.slice(PREFIX.length) : message
}
