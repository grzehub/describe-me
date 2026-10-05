import { useState } from 'react'
import { afterTicks } from './after-ticks'

/** Resolves to an error message three ticks after the call, like a form library's resolver. */
function validateQuantity(value: string): Promise<string> {
  return new Promise((resolve) => {
    afterTicks(3, () => resolve(Number(value) >= 1 ? '' : 'Enter 1 or more'))
  })
}

/** A controlled field with async validation, like a form library's `Controller`. */
export function QuantityField() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function change(next: string) {
    setValue(next)
    void validateQuantity(next).then(setError)
  }

  return (
    <div>
      <label>
        Quantity <input value={value} onChange={(event) => change(event.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
