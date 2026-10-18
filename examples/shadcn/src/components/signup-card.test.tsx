import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignupCard } from './signup-card'

describe('SignupCard', () => {
  it('submits the email', async () => {
    const onSubmit = vi.fn()
    const screen = await render(<SignupCard onSubmit={onSubmit} />)
    await userEvent.fill(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Request access' }))
    expect(onSubmit).toHaveBeenCalledWith('ada@example.com')
  })
})
