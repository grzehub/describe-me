import { useEffect, useState } from 'react'

export interface AsyncGreetingProps {
  /** Who to greet once loaded. */
  name: string
  /** How long the loader shows, in milliseconds. */
  delay?: number
}

/** Shows a loader first, like a component behind data loading or async providers. */
export function AsyncGreeting({ name, delay = 20 }: AsyncGreetingProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), delay)

    return () => clearTimeout(timer)
  }, [delay])

  if (!loaded) {
    return <p aria-busy="true">Loading…</p>
  }

  // One string, so the snapshot holds the greeting in one text node, not two.
  return <p>{`Hello, ${name}`}</p>
}
