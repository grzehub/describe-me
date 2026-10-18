import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

describe('Card', () => {
  it('renders a header, content and footer', async () => {
    const screen = await render(
      <Card className="w-[360px]">
        <CardHeader>
          <CardTitle>Team plan</CardTitle>
          <CardDescription>Everything in Pro, for up to ten people.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Shared projects, roles and a single invoice.</p>
        </CardContent>
        <CardFooter>
          <Button className="w-full">Upgrade</Button>
        </CardFooter>
      </Card>,
    )

    await expect.element(screen.getByText('Team plan')).toBeVisible()
  })
})
