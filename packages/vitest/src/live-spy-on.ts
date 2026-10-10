import { liveMock, type LiveImplementation, type LiveMock } from './live-mock.js'

/**
 * `vi.spyOn()` on the live page. It replaces a method with a mock named after
 * the key, which calls the original. With an access type it leaves the
 * property alone and returns a mock.
 */
export function liveSpyOn(object: object, key: PropertyKey, accessType?: 'get' | 'set'): LiveMock {
  if (accessType !== undefined) {
    return liveMock({ name: String(key) })
  }

  const target = object as Record<PropertyKey, unknown>
  const original = target[key]

  const spy = liveMock({
    name: String(key),
    implementation: typeof original === 'function' ? (original as LiveImplementation) : undefined,
    restore: () => {
      target[key] = original
    },
  })

  try {
    target[key] = spy
  } catch {
    // A frozen object, such as a module namespace, keeps its method, and the arrange phase goes on.
  }

  return spy
}
