const scope = globalThis as typeof globalThis & { liveFixtureLog?: string[] }

/** Notes one step of the arrange phase. `pnpm check-live` reads the list from the live frame. */
export function logStep(label: string): void {
  scope.liveFixtureLog ??= []
  scope.liveFixtureLog.push(label)
}

/** A copy of the steps so far. */
export function loggedSteps(): string[] {
  return [...(scope.liveFixtureLog ?? [])]
}
