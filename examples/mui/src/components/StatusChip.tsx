import Chip from '@mui/material/Chip'

export interface StatusChipProps {
  /** The state of the subscription. */
  status: 'active' | 'paused' | 'failed'
}

const chips = {
  active: { label: 'Active', color: 'success' },
  paused: { label: 'Paused', color: 'default' },
  failed: { label: 'Failed', color: 'error' },
} as const

/** The state of a subscription as a small colored label. */
export function StatusChip({ status }: StatusChipProps) {
  const { label, color } = chips[status]

  return <Chip label={label} color={color} size="small" />
}
