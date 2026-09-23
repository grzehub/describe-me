import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { step } from '@describe-me/vitest'
import { userEvent } from 'vitest/browser'
import { Menu } from './Menu'

const items = ['Duplicate', 'Rename', 'Delete']

describe('Menu', () => {
  it('opens on click and closes on Escape', async () => {
    const screen = await render(<Menu label="Actions" items={items} />)
    await userEvent.click(screen.getByRole('button'))
    await expect.element(screen.getByRole('menu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
  })

  it('selects an item and reports it', async () => {
    const onSelect = vi.fn()
    const screen = await render(<Menu label="Actions" items={items} onSelect={onSelect} />)
    await step('open the menu', () => userEvent.click(screen.getByRole('button')))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(onSelect).toHaveBeenCalledWith('Rename')
    await expect.element(screen.getByText('selected: Rename')).toBeVisible()
  })
})
