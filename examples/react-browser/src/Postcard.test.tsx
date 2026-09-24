import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Postcard } from './Postcard'

describe('Postcard', () => {
  it('shows a photo on a patterned card', async () => {
    const screen = await render(<Postcard place="Karkonosze" />)

    await expect.element(screen.getByRole('img', { name: 'Hills near Karkonosze' })).toBeVisible()
  })
})
