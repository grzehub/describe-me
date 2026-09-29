import { memo, Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { Badge } from './Badge'
import { Panel } from './Panel'
import { Text } from './Text'
import { render as renderWithProviders } from './test-utils'
import { theme } from './theme'

// Defined here on purpose: the plugin never registers a test file's components.
const Local = memo(function LocalBadge() {
  return <Badge tone="info">synced</Badge>
})

function SuspendedPanel() {
  return <Panel title="Suspended">Loaded without waiting.</Panel>
}

function Alert() {
  return <Badge tone="danger">rejected</Badge>
}

describe('Naming', () => {
  it('names Badge tone=danger inside a ThemeProvider', () => {
    const screen = render(
      <ThemeProvider theme={theme}>
        <Badge tone="danger">overdue</Badge>
      </ThemeProvider>,
    )

    expect(screen.getByText('overdue')).toBeDefined()
  })

  it('names Badge tone=info from a test-local memo', () => {
    const screen = render(<Local />)

    expect(screen.getByText('synced')).toBeDefined()
  })

  it('names Text size=small inside a fragment', () => {
    const screen = renderWithProviders(
      <>
        <Text size="small">Fine print</Text>
      </>,
    )

    expect(screen.getByText('Fine print')).toBeDefined()
  })

  it('names Panel title=Suspended inside Suspense', () => {
    const screen = render(
      <Suspense fallback={<Badge tone="info">loading</Badge>}>
        <SuspendedPanel />
      </Suspense>,
    )

    expect(screen.getByText('Suspended')).toBeDefined()
  })

  it('names Badge tone=danger under the test-utils wrapper', () => {
    const screen = renderWithProviders(<Alert />)

    expect(screen.getByText('rejected')).toBeDefined()
  })

  it('names Badge tone=danger after a rerender from an empty fragment', () => {
    const screen = render(<></>)
    screen.rerender(<Badge tone="danger">blocked</Badge>)

    expect(screen.getByText('blocked')).toBeDefined()
  })
})
