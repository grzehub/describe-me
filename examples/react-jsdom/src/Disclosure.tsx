import { useState } from 'react'
import './styles.css'

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
      <button
        type="button"
        className="btn btn-primary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open ? <p className="disclosure-body">{children}</p> : null}
    </div>
  )
}
