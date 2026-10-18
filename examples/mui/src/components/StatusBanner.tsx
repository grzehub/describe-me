import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import type { ReactNode } from 'react'

export interface StatusBannerProps {
  /** How serious the message is, which sets the color and the icon. */
  severity: 'success' | 'info' | 'warning' | 'error'
  /** The headline of the banner. */
  title: string
  children: ReactNode
}

/** A message about the state of the account, shown above the page content. */
export function StatusBanner({ severity, title, children }: StatusBannerProps) {
  return (
    <Alert severity={severity}>
      <AlertTitle>{title}</AlertTitle>
      {children}
    </Alert>
  )
}
