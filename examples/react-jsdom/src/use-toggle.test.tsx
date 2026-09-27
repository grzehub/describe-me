import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToggle } from './use-toggle'

// renderHook records no frames, so the module stays out of the manifest. Its
// tree must still be unmounted before the next test.
describe('useToggle', () => {
  it('flips its value', () => {
    const { result } = renderHook(() => useToggle())

    act(() => {
      result.current[1]()
    })

    expect(result.current[0]).toBe(true)
  })

  it('is unmounted after each test', () => {
    expect(document.body.childElementCount).toBe(0)
  })
})
