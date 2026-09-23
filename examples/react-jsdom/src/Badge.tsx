import styled from 'styled-components'
import './styles.css'

// Literal colours rather than the CSS variables, on purpose: this component
// stands for CSS-in-JS, and check-styles looks for these exact values.
const Root = styled.span<{ $tone: 'info' | 'danger' }>`
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ $tone }) => ($tone === 'danger' ? 'rgb(221, 51, 51)' : 'rgb(43, 92, 255)')};
  background: ${({ $tone }) => ($tone === 'danger' ? 'rgb(252, 234, 234)' : 'rgb(234, 239, 255)')};
`

export interface BadgeProps {
  /** Which palette the badge uses. */
  tone?: 'info' | 'danger'
  children: React.ReactNode
}

/** A styled-components pill, the shape a real design system ships. */
export function Badge({ tone = 'info', children }: BadgeProps) {
  return <Root $tone={tone}>{children}</Root>
}
