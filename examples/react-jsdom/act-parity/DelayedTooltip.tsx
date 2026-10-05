import { useState } from 'react'
import { afterTicks } from './after-ticks'

/** Opens its tooltip three ticks after the pointer enters, like a tooltip with an open delay. */
export function DelayedTooltip() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onMouseEnter={() => afterTicks(3, () => setOpen(true))}>
        Help
      </button>
      {open ? <span role="tooltip">Opens the help center</span> : null}
    </div>
  )
}
