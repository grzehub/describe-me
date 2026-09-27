import { useEffect, useState } from 'react'
import './styles.css'

export interface ToastProps {
  /** What the toast says. */
  message: string
  /** How long the toast stays up, in milliseconds. */
  duration?: number
}

/**
 * A message that hides itself after `duration` or when dismissed, inside a
 * status region that stays mounted.
 */
export function Toast({ message, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration)

    return () => clearTimeout(timer)
  }, [duration])

  return (
    <div role="status">
      {visible ? (
        <p className="panel">
          <span>{message}</span>{' '}
          <button
            type="button"
            className="btn btn-primary"
            aria-label="dismiss"
            onClick={() => setVisible(false)}
          >
            ×
          </button>
        </p>
      ) : null}
    </div>
  )
}
