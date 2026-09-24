import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders a neutral chip', async () => {
    const screen = await render(<Chip label="design" />)

    await expect.element(screen.getByText('design')).toHaveClass('chip-neutral')
  })

  it('can be removed', async () => {
    const onRemove = vi.fn()
    const screen = await render(<Chip label="tokens" tone="accent" onRemove={onRemove} />)

    await screen.getByRole('button', { name: 'remove tokens' }).click()

    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
