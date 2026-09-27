// Without the plugin, this import registers Testing Library's own beforeAll,
// which sets the flag, so the test holds with DESCRIBE_ME=off too.
import '@testing-library/react'
import { describe, expect, it } from 'vitest'

type ActEnvironment = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

// Renders nothing, so it records nothing: the module stays out of the manifest.
describe('act environment', () => {
  it('is flagged, so React warns about updates outside act()', () => {
    expect((globalThis as ActEnvironment).IS_REACT_ACT_ENVIRONMENT).toBe(true)
  })
})
