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

/** A beta signup composed from the shadcn/ui primitives, the way a product screen uses them. */
export function SignupCard({ onSubmit }: SignupCardProps) {
  const emailId = useId()
  const [email, setEmail] = useState('')

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
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Later</Button>
        <Button onClick={() => onSubmit?.(email)}>Request access</Button>
      </CardFooter>
    </Card>
  )
}
