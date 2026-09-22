import 'styled-components'
import type { theme } from './theme'

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: (typeof theme)['colors']
  }
}
