import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Swatch } from './Swatch'

describe('Split CSS plugin', () => {
  it('paints with the CSS of its serve half', async () => {
    const screen = await render(<Swatch />)

    await expect
      .element(screen.getByText('swatch'))
      .toHaveStyle({ backgroundColor: 'rgb(0, 128, 0)', color: 'rgb(0, 0, 255)' })
  })
})
