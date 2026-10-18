import { createTheme } from '@mui/material/styles'

/** The product's Material UI theme: a brand palette in both color schemes, Roboto and rounder corners. */
export const theme = createTheme({
  cssVariables: process.env.MUI_CSS_VARS === '1',
  colorSchemes: {
    light: { palette: { primary: { main: '#5b4bdb' }, secondary: { main: '#00897b' } } },
    dark: { palette: { primary: { main: '#a99cff' }, secondary: { main: '#4db6ac' } } },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  spacing: 8,
})
