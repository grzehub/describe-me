import { useEffect, useState } from 'react'

/** Marks itself ready one tick after it mounts. */
export function ReadyBadge() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0)

    return () => clearTimeout(timer)
  }, [])

  return <span>{ready ? 'Ready' : 'Starting'}</span>
}
