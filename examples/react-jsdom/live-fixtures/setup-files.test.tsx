import { render, screen } from '@testing-library/react'
import { Greeting } from './Greeting'

describe('Setup files', () => {
  it('serve the data the component fetches', async () => {
    render(<Greeting />)

    expect(await screen.findByText('Hello from the stub server')).toBeDefined()
  })
})
