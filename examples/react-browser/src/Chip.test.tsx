import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Chip } from './Chip'

// The chips live in state here, so a removed one also disappears in Live.
function Tags({ onRemove }: { onRemove: (label: string) => void }) {
  const [labels, setLabels] = useState(['tokens', 'design'])

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {labels.map((label, index) => (
        <Chip
          key={label}
          label={label}
          tone={index === 0 ? 'accent' : 'neutral'}
          onRemove={() => {
            setLabels((current) => current.filter((kept) => kept !== label))
            onRemove(label)
          }}
        />
      ))}
    </div>
  )
}

describe('Chip', () => {
  it('renders a neutral chip', async () => {
    const screen = await render(<Chip label="design" />)

    await expect.element(screen.getByText('design')).toHaveClass('chip-neutral')
  })

  it('can be removed', async () => {
    const onRemove = vi.fn()
    const screen = await render(<Tags onRemove={onRemove} />)

    await screen.getByRole('button', { name: 'remove tokens' }).click()

    await expect.element(screen.getByText('tokens')).not.toBeInTheDocument()
    expect(onRemove).toHaveBeenCalledWith('tokens')
  })
})
