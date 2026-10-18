import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { theme } from './theme'

export * from '@testing-library/react'

// No `enableColorScheme`: a `color-scheme` on the page would make Chromium paint an opaque
// backdrop behind the viewer's frame.
function AllTheProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

/**
 * The custom render a Material UI project keeps in its test utils: the theme and
 * CssBaseline around every component, as the app's root has them.
 */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

export { customRender as render }
