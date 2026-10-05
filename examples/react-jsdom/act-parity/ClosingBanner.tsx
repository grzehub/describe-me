import { useState } from 'react'

/** Hides itself one tick after its close button is clicked, like a banner with an exit transition. */
export function ClosingBanner() {
  const [open, setOpen] = useState(true)

  if (!open) {
    return null
  }

  return (
    <div role="status">
      Saved{' '}
      <button type="button" onClick={() => setTimeout(() => setOpen(false), 0)}>
        Close
      </button>
    </div>
  )
}
