import { useState } from 'react'
import { Button } from './Button'
import './components.css'

export interface DisclosureProps {
  /** Label of the toggle button. */
  label: string
  children: React.ReactNode
}

/** A button that shows and hides its body. */
export function Disclosure({ label, children }: DisclosureProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <Button tone="quiet" onClick={() => setOpen(!open)}>
        {label}
      </Button>
      {open ? <p className="disclosure-body">{children}</p> : null}
    </div>
  )
}
