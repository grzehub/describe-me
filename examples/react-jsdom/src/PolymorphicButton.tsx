import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ElementType,
  type ForwardedRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import styled from 'styled-components'

// The polymorphic pattern of the design system this example stands for: the
// element is chosen by `component`, and the props follow it.
type ComponentProp<T extends ElementType> = { component?: T }
type PropsToOmit<T extends ElementType, P> = keyof (ComponentProp<T> & P)

type PolymorphicComponentProp<T extends ElementType, Props = object> = PropsWithChildren<
  Props & ComponentProp<T>
> &
  Omit<ComponentPropsWithoutRef<T>, PropsToOmit<T, Props>>

export type PolymorphicComponentPropWithRef<
  T extends ElementType,
  Props = object,
> = PolymorphicComponentProp<T, Props> & { ref?: ComponentPropsWithRef<T>['ref'] }

export interface ButtonProps {
  /** Visual weight. */
  variant?: 'primary' | 'secondary'
  size?: 'small' | 'large'
}

export type ButtonComponent = <T extends ElementType = 'button'>(
  props: Omit<PolymorphicComponentPropWithRef<T, ButtonProps>, 'disabled'>,
) => ReactNode | null

const Root = styled.button<{ $variant: 'primary' | 'secondary'; $size: 'small' | 'large' }>`
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.ink};
  padding: ${({ $size }) => ($size === 'small' ? '6px 10px' : '10px 16px')};
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  color: ${({ $variant, theme }) => ($variant === 'primary' ? 'white' : theme.colors.ink)};
  background: ${({ $variant, theme }) => ($variant === 'primary' ? theme.colors.ink : 'white')};
`

/**
 * A button that can render as any element (`component="a"`). An anonymous
 * generic `forwardRef`: it has no name of its own, so it is documented under
 * its export.
 */
export const Button: ButtonComponent = forwardRef(
  <T extends ElementType = 'button'>(
    {
      children,
      variant = 'primary',
      size = 'large',
      component,
      ...rest
    }: PolymorphicComponentPropWithRef<T, ButtonProps>,
    // The design system writes `ComponentPropsWithRef<T>['ref']` here, which
    // React 19's types no longer accept from `forwardRef`. Props are unaffected.
    ref?: ForwardedRef<unknown>,
  ) => {
    return (
      <Root as={component ?? 'button'} ref={ref} $variant={variant} $size={size} {...rest}>
        {children}
      </Root>
    )
  },
)
