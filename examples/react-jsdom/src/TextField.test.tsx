import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from './TextField'

describe('TextField', () => {
  it('shows focus while typing', async () => {
    const user = userEvent.setup()
    const screen = render(<TextField label="Name" />)
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' })

    await user.type(field, 'Ada')

    expect(field.value).toBe('Ada')
  })
})
