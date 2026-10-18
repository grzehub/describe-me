import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render } from '../test-utils'
import { SignupForm } from './SignupForm'

describe('SignupForm', () => {
  it('submits the email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const screen = render(<SignupForm onSubmit={onSubmit} />)

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(onSubmit).toHaveBeenCalledWith('ada@example.com')
  })

  it('flags an invalid email', async () => {
    const user = userEvent.setup()
    const screen = render(<SignupForm />)

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Enter a valid email address')).toBeDefined()
  })
})
