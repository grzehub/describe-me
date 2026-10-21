import './components.css'

export interface ButtonProps {
  /** `primary` fills with the accent, `quiet` is an outlined button. */
  tone?: 'primary' | 'quiet'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

/** The one button of this small design system. */
export function Button({ tone = 'primary', disabled, onClick, children }: ButtonProps) {
  return (
    <button type="button" className={`button ${tone}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
