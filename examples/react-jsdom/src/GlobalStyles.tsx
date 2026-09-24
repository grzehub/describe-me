import { createGlobalStyle } from 'styled-components'

/**
 * The global stylesheet a styled-components design system renders once, next
 * to its ThemeProvider. The custom property is what check-styles looks for.
 */
export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  body {
    --global-styles: applied;
    color: ${({ theme }) => theme.colors.ink};
  }
`
