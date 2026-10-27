import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Greeting } from './Greeting'
import { server } from './server.node'

describe('Setup files', () => {
  it('serve the data the component fetches', async () => {
    render(<Greeting />)

    expect(await screen.findByText('Hello from the stub server')).toBeDefined()
  })

  it('answer with a handler of the test', async () => {
    server.use(
      http.get('/api/greeting', () => HttpResponse.json({ greeting: 'Hello from the test' })),
    )

    render(<Greeting />)

    expect(await screen.findByText('Hello from the test')).toBeDefined()
  })
})
