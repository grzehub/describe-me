import { useState } from 'react'

export interface DisclosureProps {
  /** Label of the toggle button. */
  label: string
  children: React.ReactNode
}

/** Stateful on purpose: the DOM has to change, or the recorder dedupes the frame away. */
export function Disclosure({ label, children }: DisclosureProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open ? <p>{children}</p> : null}
    </div>
  )
}
