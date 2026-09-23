import styled from 'styled-components'
import './styles.css'

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.ink};
`

export interface HeadingProps {
  children: React.ReactNode
}

/** Reads its colour from the theme, so it only renders right inside the providers. */
export function Heading({ children }: HeadingProps) {
  return <Title>{children}</Title>
}
