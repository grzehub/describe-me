import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Input } from './input'
import { Label } from './label'
import { Switch } from './switch'

describe('Input', () => {
  it('renders a placeholder', async () => {
    const screen = await render(<Input className="w-[280px]" placeholder="you@example.com" />)
    await expect.element(screen.getByPlaceholder('you@example.com')).toBeVisible()
  })

  it('renders disabled', async () => {
    const screen = await render(<Input className="w-[280px]" placeholder="Read only" disabled />)
    await expect.element(screen.getByRole('textbox')).toBeDisabled()
  })
})

describe('Switch', () => {
  // The Switch comes before its Label, because the test is named after the first component.
  it('turns on when clicked', async () => {
    const screen = await render(
      <div className="flex items-center gap-2 p-4">
        <Switch id="product-news" />
        <Label htmlFor="product-news">Product news</Label>
      </div>,
    )

    await screen.getByRole('switch', { name: 'Product news' }).click()
    await expect.element(screen.getByRole('switch', { name: 'Product news' })).toBeChecked()
  })
})
