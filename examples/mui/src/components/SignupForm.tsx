import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useState } from 'react'

export interface SignupFormProps {
  /** Called with the email once it looks valid. */
  onSubmit?: (email: string) => void
}

/** The account signup, which checks the email before it hands it on. */
export function SignupForm({ onSubmit }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)

  // A click handler instead of a <form> submit, because jsdom does not implement form navigation.
  function submit() {
    if (!email.includes('@')) {
      setInvalid(true)

      return
    }

    setInvalid(false)
    onSubmit?.(email)
  }

  return (
    <Stack spacing={2} sx={{ width: 320 }}>
      <TextField
        label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={invalid}
        helperText={invalid ? 'Enter a valid email address' : undefined}
      />
      <FormControlLabel control={<Checkbox />} label="Send me product news" />
      <Button variant="contained" onClick={submit}>
        Create account
      </Button>
    </Stack>
  )
}
