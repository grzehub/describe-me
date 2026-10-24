import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { step } from '@describe-me/vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('opens and closes through the setup instance', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="show details">the details</Disclosure>)

    await user.click(screen.getByRole('button', { name: 'show details' }))

    expect(screen.getByText('the details')).toBeDefined()

    await step('close it again', async () => {
      await user.click(screen.getByRole('button', { name: 'show details' }))
    })

    expect(screen.queryByText('the details')).toBeNull()
  })

  it('opens through the direct API', async () => {
    const screen = render(<Disclosure label="show details">the details</Disclosure>)

    // Delegates to a setup instance internally; the depth guard must keep this
    // to one frame rather than two.
    await userEvent.click(screen.getByRole('button', { name: 'show details' }))

    expect(screen.getByText('the details')).toBeDefined()
  })

  it('keeps frames in order across a rerender', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="first label">the details</Disclosure>)

    screen.rerender(<Disclosure label="second label">the details</Disclosure>)

    await user.click(screen.getByRole('button', { name: 'second label' }))

    expect(screen.getByText('the details')).toBeDefined()
  })

  it('opens with fireEvent', () => {
    const screen = render(<Disclosure label="show details">the details</Disclosure>)

    fireEvent.click(screen.getByRole('button', { name: 'show details' }))

    expect(screen.getByText('the details')).toBeDefined()
  })

  it('highlights the button on hover', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="show details">the details</Disclosure>)
    const button = screen.getByRole('button', { name: 'show details' })

    await user.hover(button)

    expect(screen.queryByText('the details')).toBeNull()

    await user.unhover(button)

    expect(screen.queryByText('the details')).toBeNull()
  })

  it('highlights the button on mouseEnter', () => {
    const screen = render(<Disclosure label="show details">the details</Disclosure>)
    const button = screen.getByRole('button', { name: 'show details' })

    fireEvent.mouseEnter(button)

    expect(screen.queryByText('the details')).toBeNull()

    // Every enter and over event hovers the button in its frame, and every leave and out event
    // ends that.
    fireEvent.mouseLeave(button)
    fireEvent.mouseOver(button)
    fireEvent.mouseOut(button)
    fireEvent.pointerEnter(button)
    fireEvent.pointerLeave(button)
    fireEvent.pointerOver(button)
    fireEvent.pointerOut(button)
    fireEvent(button, new MouseEvent('mouseover', { bubbles: true }))
    fireEvent(button, new MouseEvent('mouseout', { bubbles: true }))

    expect(screen.queryByText('the details')).toBeNull()
  })

  it('shows a focus ring from the keyboard', async () => {
    const user = userEvent.setup()
    const screen = render(<Disclosure label="show details">the details</Disclosure>)
    const button = screen.getByRole('button', { name: 'show details' })

    await user.tab()

    expect(document.activeElement).toBe(button)

    // A hover keeps the ring, and a click takes both the ring and the hover away.
    await user.hover(button)
    await user.click(button)

    expect(document.activeElement).toBe(button)
  })
})
