import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from './TextField'

describe('TextField', () => {
  it('shows focus while typing', async () => {
    const user = userEvent.setup()
    const screen = render(
      <>
        <TextField label="Name" />
        <TextField label="Bio" multiline />
        <div className="field">
          <div role="textbox" aria-label="Notes" contentEditable suppressContentEditableWarning>
            Call Ada
          </div>
          <div role="textbox" aria-label="Read only" contentEditable={false} tabIndex={0}>
            Ada Lovelace
          </div>
        </div>
      </>,
    )

    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' })

    await user.type(field, 'Ada')

    expect(field.value).toBe('Ada')

    // A click gives a textarea and a contenteditable element the ring too, as in a browser,
    // but not an element whose contenteditable is false.
    for (const name of ['Bio', 'Notes', 'Read only']) {
      await user.click(screen.getByRole('textbox', { name }))

      expect(document.activeElement).toBe(screen.getByRole('textbox', { name }))
    }
  })
})
