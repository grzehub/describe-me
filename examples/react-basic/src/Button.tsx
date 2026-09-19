import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './styles.css'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const blocked = disabled || loading
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (!blocked) onClick?.(e)
      }}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  )
}
