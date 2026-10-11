const scope = globalThis as typeof globalThis & { liveFixtureEvents?: string[] }

/** What `setup.ts` mocks with `vi.mock`. The live preview keeps the real module. */
export function track(event: string): void {
  scope.liveFixtureEvents ??= []
  scope.liveFixtureEvents.push(event)
}
