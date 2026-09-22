import styled from 'styled-components'

const Title = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.colors.accent};
`

export interface HeadingProps {
  children: React.ReactNode
}

/** Reads its colour from the theme, so it only renders right inside the providers. */
export function Heading({ children }: HeadingProps) {
  return <Title>{children}</Title>
}
