import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { theme } from './theme'

export * from '@testing-library/react'

function AllTheProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

/**
 * The custom render most design systems keep in their test utils. It imports
 * @testing-library/react itself, so the plugin's redirect records through it
 * without the tests or this file knowing.
 */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

export { customRender as render }
