import { describe, expect, it, vi } from 'vitest'
import { render } from '@describe-me/react'
import { userEvent } from '@describe-me/vitest'
import { Button } from './Button'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary by default', async () => {
      const screen = await render(<Button>Save changes</Button>)
      await expect.element(screen.getByRole('button')).toHaveClass('btn-primary')
    })

    it('renders secondary', async () => {
      const screen = await render(<Button variant="secondary">Cancel</Button>)
      await expect.element(screen.getByRole('button')).toHaveClass('btn-secondary')
    })

    it('renders ghost', async () => {
      const screen = await render(<Button variant="ghost">Learn more</Button>)
      await expect.element(screen.getByRole('button')).toHaveClass('btn-ghost')
    })
  })

  describe('sizes', () => {
    it('renders small and large', async () => {
      const screen = await render(<Button size="lg">Large</Button>)
      await expect.element(screen.getByRole('button')).toHaveClass('btn-lg')
      await screen.rerender(<Button size="sm">Small</Button>)
      await expect.element(screen.getByRole('button')).toHaveClass('btn-sm')
    })
  })

  describe('states', () => {
    it('calls onClick when enabled', async () => {
      const onClick = vi.fn()
      const screen = await render(<Button onClick={onClick}>Click me</Button>)
      await userEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('is disabled', async () => {
      const screen = await render(<Button disabled>Unavailable</Button>)
      await expect.element(screen.getByRole('button')).toBeDisabled()
    })

    it('shows a spinner while loading and swallows clicks', async () => {
      const onClick = vi.fn()
      const screen = await render(
        <Button loading onClick={onClick}>
          Saving
        </Button>,
      )

      await expect.element(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
      await userEvent.click(screen.getByRole('button'), { force: true })
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
