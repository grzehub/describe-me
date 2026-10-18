import Stack from '@mui/material/Stack'
import { describe, expect, it } from 'vitest'
import { render } from '../test-utils'
import { StatusBanner } from './StatusBanner'
import { StatusChip } from './StatusChip'

describe('StatusBanner', () => {
  it('renders every severity', () => {
    const screen = render(
      <Stack spacing={2} sx={{ width: 420 }}>
        <StatusBanner severity="success" title="Payment received">
          Your plan renews on 1 March.
        </StatusBanner>
        <StatusBanner severity="info" title="Scheduled maintenance">
          The dashboard is read-only on Sunday morning.
        </StatusBanner>
        <StatusBanner severity="warning" title="Card expires soon">
          Update it before the next invoice.
        </StatusBanner>
        <StatusBanner severity="error" title="Payment failed">
          We could not charge the card on file.
        </StatusBanner>
      </Stack>,
    )

    expect(screen.getAllByRole('alert')).toHaveLength(4)
  })
})

describe('StatusChip', () => {
  it('renders every status', () => {
    const screen = render(
      <Stack direction="row" spacing={1}>
        <StatusChip status="active" />
        <StatusChip status="paused" />
        <StatusChip status="failed" />
      </Stack>,
    )

    expect(screen.getByText('Failed')).toBeDefined()
  })
})
