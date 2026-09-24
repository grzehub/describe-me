import styled from 'styled-components'

export interface TextProps {
  /** Step on the type scale. */
  size?: 'small' | 'medium' | 'large'
  /** Secondary information, in a quieter colour. */
  muted?: boolean
}

const FONT_SIZES: Record<NonNullable<TextProps['size']>, string> = {
  small: '12px',
  medium: '14px',
  large: '18px',
}

const OWN_PROPS = ['size', 'muted']

/**
 * Body copy, exported as a bare styled component the way many design systems
 * do. Its default display name is `styled.p`, so it is documented under its
 * export instead.
 */
export const Text = styled.p.withConfig({
  shouldForwardProp: (prop) => !OWN_PROPS.includes(prop),
})<TextProps>`
  margin: 0;
  font-size: ${({ size = 'medium' }) => FONT_SIZES[size]};
  color: ${({ muted, theme }) => (muted ? 'rgb(107, 107, 107)' : theme.colors.ink)};
`
