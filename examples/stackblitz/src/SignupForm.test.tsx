import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { step } from '@describe-me/vitest'
import { SignupForm } from './SignupForm'

// Live in the viewer mounts the component as the test arranged it, up to the
// first action, and shows every call of a vi.fn() prop as it happens.
describe('SignupForm', () => {
  it('submits the email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const screen = render(<SignupForm onSubmit={onSubmit} />)

    await step('type the email', async () => {
      await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    })

    await user.click(screen.getByRole('button', { name: 'Request access' }))

    expect(screen.getByText('You are on the list')).toBeDefined()
    expect(onSubmit).toHaveBeenCalledWith('ada@example.com')
  })

  it('rejects an empty email', async () => {
    const user = userEvent.setup()
    const screen = render(<SignupForm />)

    await user.click(screen.getByRole('button', { name: 'Request access' }))

    expect(screen.getByRole('alert').textContent).toBe(
      'Enter an email address, so we can reach you.',
    )

    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
  })
})
