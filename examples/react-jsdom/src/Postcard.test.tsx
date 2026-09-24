import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Postcard } from './Postcard'

describe('Postcard', () => {
  it('shows a photo on a patterned card', () => {
    const screen = render(<Postcard place="Karkonosze" />)

    expect(screen.getByRole('img', { name: 'Hills near Karkonosze' })).toBeDefined()
  })
})
