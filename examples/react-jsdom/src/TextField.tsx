import { useId } from 'react'
import './styles.css'

export interface TextFieldProps {
  /** Text of the label above the input. */
  label: string
  /** Shown while the input is empty. */
  placeholder?: string
}

/** A labelled text input whose styles leave its focus ring to the browser. */
export function TextField({ label, placeholder }: TextFieldProps) {
  const id = useId()

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" placeholder={placeholder} />
    </div>
  )
}
