/** The first line of what a caught value says, for a diagnostic that must stay one sentence. */
export function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.split('\n')[0].trim()
}
