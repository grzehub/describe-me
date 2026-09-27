import { useCallback, useState } from 'react'

/** A boolean and a stable function that flips it. */
export function useToggle(initial = false): [boolean, () => void] {
  const [on, setOn] = useState(initial)
  const toggle = useCallback(() => setOn((current) => !current), [])

  return [on, toggle]
}
