import { useEffect, useState } from 'react'
import { track } from './analytics'

/** Fetches its greeting from `/api/greeting`, which only a setup file answers. */
export function Greeting() {
  const [greeting, setGreeting] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void fetch('/api/greeting')
      .then((response) => response.json() as Promise<{ greeting: string }>)
      .then((data) => {
        if (active) {
          setGreeting(data.greeting)
          track('greeting shown')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return <p>{greeting ?? 'Loading…'}</p>
}
