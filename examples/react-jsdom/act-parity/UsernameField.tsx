import { useState } from 'react'
import { afterTicks } from './after-ticks'

/** The status arrives three ticks after each change, like a debounced availability check. */
export function UsernameField() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('')

  function change(next: string) {
    setValue(next)
    afterTicks(3, () => setStatus('Available'))
  }

  return (
    <div>
      <label>
        Username <input value={value} onChange={(event) => change(event.target.value)} />
      </label>
      {status ? <p>{status}</p> : null}
    </div>
  )
}
