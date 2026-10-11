import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'

describe('Node-only import', () => {
  it('reads a file in the arrange phase', () => {
    const text = readFileSync(`${import.meta.dirname}/greeting.json`, 'utf8')

    render(<pre>{text}</pre>)
  })
})
