import { CircleAlert, MailCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SignupCardProps {
  /** Called with the typed email when the visitor requests access. */
  onSubmit?: (email: string) => void
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A beta signup composed from the shadcn/ui primitives, the way a product screen uses them. */
export function SignupCard({ onSubmit }: SignupCardProps) {
  const emailId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  function request() {
    if (!EMAIL.test(email)) {
      setError('Enter an email address, so we can reach you.')

      return
    }

    setError(null)
    setRequested(true)
    onSubmit?.(email)
  }

  if (requested) {
    return (
      <Card className="w-[360px]">
        <CardHeader>
          <MailCheck className="size-6 text-primary" aria-hidden="true" />
          <CardTitle>You are on the list</CardTitle>
          <CardDescription>We will write to {email} when your seat is ready.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Join the beta</CardTitle>
        <CardDescription>We send one email when your seat is ready.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            placeholder="you@example.com"
            value={email}
            aria-invalid={error !== null || undefined}
            aria-describedby={error === null ? undefined : errorId}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
          />
          {error !== null && (
            <p
              id={errorId}
              role="alert"
              className="flex items-center gap-1.5 text-sm text-destructive"
            >
              <CircleAlert className="size-4" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Later</Button>
        <Button onClick={request}>Request access</Button>
      </CardFooter>
    </Card>
  )
}
