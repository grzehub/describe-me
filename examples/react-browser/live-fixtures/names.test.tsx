import { describe, expect, it, test as base } from 'vitest'
import { render } from 'vitest-browser-react'
import { Row } from './Row'

const test = base.extend<{ label: string }>({
  label: async ({}, use) => {
    await use('from a fixture')
  },
})

async function showRow(...values: unknown[]): Promise<void> {
  const screen = await render(<Row values={values} />)

  await expect.element(screen.getByText(JSON.stringify(values))).toBeVisible()
}

describe('Names', () => {
  it.each([
    ['Ada', 36, 7.9, -0.5, { tier: 'gold' }, ['a', 'b'], 'done'],
    ['Grace', 45, 2.1, 1.25, { tier: 'silver' }, [], 'open'],
  ])('each %s %d %i %f %j %o, row %# of %$, 100%%', async (...values) => {
    await showRow(...values)
  })

  it.each([
    { name: 'Ada', role: { title: 'admin' } },
    { name: 'Grace', role: { title: 'editor' } },
  ])('each $name as $role.title', async (row) => {
    await showRow(row)
  })

  it.each([
    ['first', 1],
    ['second', 2],
  ])('each $0 is number $1', async (word, number) => {
    await showRow(word, number)
  })

  it.each`
    name       | count
    ${'Ada'}   | ${1}
    ${'Grace'} | ${2}
  `('table $name has $count', async ({ name, count }) => {
    await showRow(name, count)
  })

  test.for([
    ['Ada', 1],
    ['Grace', 2],
  ])('for %s with %d', async ([name, count], { label }) => {
    await showRow(name, count, label)
  })

  it.each([
    ['twin', 'the first row'],
    ['twin', 'the second row'],
  ])('repeated %s', async (name, which) => {
    await showRow(name, which)
  })
})

describe.each(['light', 'dark'])('Names in %s', (theme) => {
  it('show the theme', async () => {
    await showRow(theme)
  })
})
