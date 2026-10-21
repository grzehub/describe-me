import { useId, useState } from 'react'
import { Button } from './Button'
import './components.css'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SignupFormProps {
  /** Called with the email once it passes validation. */
  onSubmit?: (email: string) => void
}

/** An email field, a button, and the two things that can happen next. */
export function SignupForm({ onSubmit }: SignupFormProps) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function request() {
    if (!EMAIL.test(email)) {
      setError('Enter an email address, so we can reach you.')

      return
    }

    setError(null)
    setDone(true)
    onSubmit?.(email)
  }

  if (done) {
    return (
      <div className="signup">
        <h2>You are on the list</h2>
        <p className="done">We will write to {email}.</p>
      </div>
    )
  }

  return (
    <form
      className="signup"
      onSubmit={(event) => {
        event.preventDefault()
        request()
      }}
    >
      <h2>Request access</h2>
      <p>Leave your email and we will send an invite.</p>
      <label htmlFor={id}>
        Email
        <input
          id={id}
          type="email"
          value={email}
          placeholder="you@example.com"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      ) : null}
      <Button onClick={request}>Request access</Button>
    </form>
  )
}
