import { describe, expect, it, vi } from 'vitest'
import { render } from '@describe-me/react'
import { userEvent } from 'vitest/browser'
import { SearchBox } from './SearchBox'

describe('SearchBox', () => {
  it('enables the button once there is a query', async () => {
    const screen = await render(<SearchBox />)
    await expect.element(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    await screen.getByRole('searchbox').fill('rrweb')
    await expect.element(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  it('submits the typed query', async () => {
    const onSearch = vi.fn()
    const screen = await render(<SearchBox onSearch={onSearch} />)
    await userEvent.type(screen.getByRole('searchbox'), 'vitest')
    await userEvent.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalledWith('vitest')
  })

  it('clears the query', async () => {
    const screen = await render(<SearchBox placeholder="Find a component" />)
    await screen.getByRole('searchbox').fill('Button')
    await screen.getByRole('button', { name: 'clear' }).click()
    await expect.element(screen.getByRole('searchbox')).toHaveValue('')
  })
})
