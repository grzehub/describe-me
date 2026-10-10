const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** The names of `vitest` that the shim knows, for when Vitest cannot be imported. */
const KNOWN_NAMES = [
  'describe',
  'suite',
  'it',
  'test',
  'beforeAll',
  'beforeEach',
  'afterEach',
  'afterAll',
  'aroundEach',
  'aroundAll',
  'onTestFinished',
  'onTestFailed',
  'vi',
  'vitest',
  'expect',
  'assert',
  'chai',
  'should',
  'expectTypeOf',
  'assertType',
  'createExpect',
  'inject',
  'recordArtifact',
]

/**
 * The names that the installed `vitest` exports. The shim exports the same
 * ones, so a test that imports any of them links in the live page.
 */
export async function readLiveVitestNames(): Promise<string[]> {
  try {
    const names = Object.keys(await import('vitest'))

    return names.filter((name) => name !== 'default' && IDENTIFIER.test(name))
  } catch {
    return KNOWN_NAMES
  }
}
