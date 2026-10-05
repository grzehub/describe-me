import { describe, expect, it } from 'vitest'
import { recorder } from '@describe-me/vitest'

// Equal warning counts prove nothing if recording was silently off.
describe('recording', () => {
  it('is on unless DESCRIBE_ME=off', () => {
    expect(recorder.isActive).toBe(process.env.DESCRIBE_ME !== 'off')
  })
})
