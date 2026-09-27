import { describe, expect, it } from 'vitest'
import { formatCount } from './format-count'

// Renders nothing, so it records nothing: the module stays out of the manifest.
describe('formatCount', () => {
  it('uses the singular for one', () => {
    expect(formatCount(1, 'item')).toBe('1 item')
  })

  it('uses the plural for any other count', () => {
    expect(formatCount(0, 'item')).toBe('0 items')
    expect(formatCount(3, 'item')).toBe('3 items')
  })
})
