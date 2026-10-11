import { test as base } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Row } from './Row'

const test = base.extend<{ label: string }>({
  label: async ({}, use) => {
    await use('from a fixture')
  },
})

function showRow(...values: unknown[]): void {
  render(<Row values={values} />)

  expect(screen.getByText(JSON.stringify(values))).toBeDefined()
}

describe('Names', () => {
  it.each([
    ['Ada', 36, 7.9, -0.5, { tier: 'gold' }, ['a', 'b'], 'done'],
    ['Grace', 45, 2.1, 1.25, { tier: 'silver' }, [], 'open'],
  ])('each %s %d %i %f %j %o, row %# of %$, 100%%', (...values) => {
    showRow(...values)
  })

  it.each([
    { name: 'Ada', role: { title: 'admin' } },
    { name: 'Grace', role: { title: 'editor' } },
  ])('each $name as $role.title', (row) => {
    showRow(row)
  })

  it.each([
    ['first', 1],
    ['second', 2],
  ])('each $0 is number $1', (word, number) => {
    showRow(word, number)
  })

  it.each`
    name       | count
    ${'Ada'}   | ${1}
    ${'Grace'} | ${2}
  `('table $name has $count', ({ name, count }) => {
    showRow(name, count)
  })

  test.for([
    ['Ada', 1],
    ['Grace', 2],
  ])('for %s with %d', ([name, count], { label }) => {
    showRow(name, count, label)
  })

  it.each([
    ['twin', 'the first row'],
    ['twin', 'the second row'],
  ])('repeated %s', (name, which) => {
    showRow(name, which)
  })
})

describe.each(['light', 'dark'])('Names in %s', (theme) => {
  it('show the theme', () => {
    showRow(theme)
  })
})
