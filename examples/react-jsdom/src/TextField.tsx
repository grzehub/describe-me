import { useId } from 'react'
import './styles.css'

export interface TextFieldProps {
  /** Text of the label above the field. */
  label: string
  /** Shown while the field is empty. */
  placeholder?: string
  /** A textarea for several lines instead of a one-line input. */
  multiline?: boolean
}

/** A labelled text input or textarea whose styles leave its focus ring to the browser. */
export function TextField({ label, placeholder, multiline = false }: TextFieldProps) {
  const id = useId()

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} placeholder={placeholder} rows={3} />
      ) : (
        <input id={id} type="text" placeholder={placeholder} />
      )}
    </div>
  )
}
