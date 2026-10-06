// `publish-testing-library-act.ts` in @describe-me/react writes this key.
const ACT_CHECK = Symbol.for('describe-me.testing-library-act')

type ActCheckHost = typeof globalThis & { [ACT_CHECK]?: unknown }

/**
 * Whether @testing-library/dom still runs user-event calls through the
 * `asyncWrapper` that @testing-library/react installed, so the DOM is committed
 * when a call resolves. False when @describe-me/react/testing-library never loaded.
 */
export function testingLibraryWrapsInAct(): boolean {
  const check = (globalThis as ActCheckHost)[ACT_CHECK]

  return typeof check === 'function' && check() === true
}
