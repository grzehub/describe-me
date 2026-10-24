import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
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

    it('highlights a ghost button on hover', async () => {
      const screen = await render(<Button variant="ghost">Learn more</Button>)
      const button = screen.getByRole('button')
      await button.hover()

      expect(getComputedStyle(button.element()).backgroundColor).toBe('rgb(242, 242, 242)')
    })

    it('is disabled', async () => {
      const screen = await render(<Button disabled>Unavailable</Button>)
      const button = screen.getByRole('button')
      await expect.element(button).toBeDisabled()
      await button.hover()

      expect(getComputedStyle(button.element()).backgroundColor).toBe('rgb(17, 17, 17)')
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

    it('shows a focus ring from the keyboard', async () => {
      const screen = await render(<Button>Continue</Button>)
      const button = screen.getByRole('button')

      // userEvent.keyboard() focuses this frame before it types, userEvent.tab() does not.
      window.focus()
      await userEvent.tab()

      await expect.element(button).toHaveFocus()
      expect(getComputedStyle(button.element()).outlineStyle).toBe('solid')
    })
  })

  it('passes other attributes to the button', async () => {
    const screen = await render(<Button title="Save the draft">Save</Button>)
    await expect.element(screen.getByRole('button')).toHaveAttribute('title', 'Save the draft')
  })
})
