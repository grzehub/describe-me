import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { clockLabel } from './clock'

vi.mock('./clock', () => ({ clockLabel: () => 'a mocked clock' }))

describe('Module mocks', () => {
  it('keep the real modules live', async () => {
    vi.doMock('./weather', () => ({ forecast: () => 'a mocked forecast' }))

    const { forecast } = await import('./weather')
    const screen = await render(
      <p>
        {clockLabel()}, {forecast()}
      </p>,
    )

    await expect.element(screen.getByText('a mocked clock, a mocked forecast')).toBeVisible()
  })
})
