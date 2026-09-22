import styled from 'styled-components'

const Root = styled.span<{ $tone: 'info' | 'danger' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: ${({ $tone }) => ($tone === 'danger' ? 'rgb(153, 27, 27)' : 'rgb(30, 64, 175)')};
  background: ${({ $tone }) => ($tone === 'danger' ? 'rgb(254, 226, 226)' : 'rgb(219, 234, 254)')};
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
