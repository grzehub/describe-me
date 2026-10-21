import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { step } from '@describe-me/vitest'
import { SignupCard } from './signup-card'

describe('SignupCard', () => {
  it('submits the email', async () => {
    const onSubmit = vi.fn()
    const screen = await render(<SignupCard onSubmit={onSubmit} />)

    await step('type the email', async () => {
      await userEvent.fill(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Request access' }))
    expect(onSubmit).toHaveBeenCalledWith('ada@example.com')
    await expect.element(screen.getByText('You are on the list')).toBeVisible()
  })

  it('rejects an empty email', async () => {
    const onSubmit = vi.fn()
    const screen = await render(<SignupCard onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Request access' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Enter an email address, so we can reach you.')

    await expect
      .element(screen.getByRole('textbox', { name: 'Email' }))
      .toHaveAttribute('aria-invalid', 'true')
  })
})
