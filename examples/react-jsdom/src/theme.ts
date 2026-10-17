/**
 * A minimal design-system theme, provided through styled-components. Same colors
 * as the tokens. `light-dark()` follows the frame's color scheme, which the
 * viewer's dark canvas makes dark.
 */
export const theme = {
  colors: {
    ink: 'light-dark(rgb(17, 17, 17), rgb(237, 237, 237))',
    paper: 'light-dark(rgb(255, 255, 255), rgb(26, 26, 26))',
    muted: 'light-dark(rgb(107, 107, 107), rgb(160, 160, 160))',
  },
}
