import { CircleAlert } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Badge } from './badge'

const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const

describe('Alert', () => {
  it('renders the default alert', async () => {
    const screen = await render(
      <Alert className="w-[420px]">
        <AlertTitle>Your changes are saved</AlertTitle>
        <AlertDescription>Everyone on the project sees them now.</AlertDescription>
      </Alert>,
    )

    await expect.element(screen.getByRole('alert')).toBeVisible()
  })

  it('renders a destructive alert', async () => {
    const screen = await render(
      <Alert variant="destructive" className="w-[420px]">
        <CircleAlert />
        <AlertTitle>Payment failed</AlertTitle>
        <AlertDescription>Check the card details and try again.</AlertDescription>
      </Alert>,
    )

    await expect.element(screen.getByText('Payment failed')).toBeVisible()
  })
})

describe('Badge', () => {
  it('renders every variant', async () => {
    const screen = await render(
      <div className="flex flex-wrap gap-2 p-4">
        {variants.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>,
    )

    await expect.element(screen.getByText('destructive')).toBeVisible()
  })
})
