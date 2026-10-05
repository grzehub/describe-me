import { useState } from 'react'
import { afterTicks } from './after-ticks'

/** A mocked fetch that resolves three ticks after the call. */
function fetchName(): Promise<string> {
  return new Promise((resolve) => afterTicks(3, () => resolve('Ada Lovelace')))
}

/** Loads a name on click and shows it once the mocked fetch resolves. */
export function ProfileLoader() {
  const [name, setName] = useState<string | null>(null)

  function load() {
    void fetchName().then(setName)
  }

  return (
    <div>
      <button type="button" onClick={load}>
        Load profile
      </button>
      {name === null ? null : <p>{name}</p>}
    </div>
  )
}
