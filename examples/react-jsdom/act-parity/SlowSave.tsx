import { useState } from 'react'

/** Shows that it saved 100 ms after the click. */
export function SlowSave() {
  const [saved, setSaved] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setTimeout(() => setSaved(true), 100)}>
        Save
      </button>
      {saved ? <p>Saved</p> : null}
    </div>
  )
}
