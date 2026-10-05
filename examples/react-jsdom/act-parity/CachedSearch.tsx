import { useState } from 'react'
import { afterTicks } from './after-ticks'

/**
 * Shows its results three ticks after a search, like a debounced fetch whose
 * result a query cache hands out a tick later.
 */
export function CachedSearch() {
  const [results, setResults] = useState<string | null>(null)

  return (
    <div>
      <button type="button" onClick={() => afterTicks(3, () => setResults('3 results'))}>
        Search
      </button>
      {results === null ? null : <p>{results}</p>}
    </div>
  )
}
