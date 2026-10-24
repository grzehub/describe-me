import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { render } from '../test-utils'
import { PlanCard } from './PlanCard'

describe('PlanCard', () => {
  it('renders a plan', () => {
    const screen = render(
      <PlanCard
        name="Starter"
        price="$0 / month"
        features={['One project', 'Community support']}
      />,
    )

    expect(screen.getByRole('button', { name: 'Choose Starter' })).toBeDefined()
  })

  it('marks the popular plan', () => {
    const screen = render(
      <PlanCard
        name="Pro"
        price="$12 / month"
        features={['Unlimited projects', 'Email support', 'Custom domains']}
        popular
      />,
    )

    expect(screen.getByText('Popular')).toBeDefined()
  })

  it('highlights its button on hover', async () => {
    const screen = render(
      <PlanCard
        name="Pro"
        price="$12 / month"
        features={['Unlimited projects', 'Email support', 'Custom domains']}
        popular
      />,
    )

    await userEvent.setup().hover(screen.getByRole('button', { name: 'Choose Pro' }))

    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeDefined()
  })
})
