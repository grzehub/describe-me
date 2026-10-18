import { Mail } from 'lucide-react'
import { describe, expect, it, onTestFinished } from 'vitest'
import { render } from 'vitest-browser-react'
import { Button } from './button'

const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const

describe('Button', () => {
  it('renders the default variant', async () => {
    const screen = await render(<Button>Save changes</Button>)
    await expect.element(screen.getByRole('button')).toHaveAttribute('data-variant', 'default')
  })

  it('renders outline with an icon', async () => {
    const screen = await render(
      <Button variant="outline">
        <Mail /> Login with Email
      </Button>,
    )

    await expect.element(screen.getByRole('button')).toHaveAttribute('data-variant', 'outline')
  })

  it('renders destructive', async () => {
    const screen = await render(<Button variant="destructive">Delete project</Button>)
    await expect.element(screen.getByRole('button')).toHaveAttribute('data-variant', 'destructive')
  })

  // An app's theme switch sets the class on <html>. It comes off in onTestFinished, which
  // runs after describe-me's closing capture, so every frame of this test is dark.
  it('renders every variant in the dark variant', async () => {
    document.documentElement.classList.add('dark')
    onTestFinished(() => {
      document.documentElement.classList.remove('dark')
    })

    const screen = await render(
      <div className="flex flex-wrap gap-2 p-4">
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>,
    )

    await expect.element(screen.getByRole('button', { name: 'ghost' })).toBeVisible()
  })
})
